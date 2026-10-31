'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LICENSE_FILE = /^(?:licen[cs]e|copying|notice|unlicen[cs]e)(?:[._ -].*)?$/i;

function licenseExpression(manifest) {
  if (typeof manifest.license === 'string') return manifest.license;
  if (Array.isArray(manifest.licenses)) {
    return manifest.licenses.map((entry) => entry.type).filter(Boolean).join(' OR ');
  }
  return '';
}

function licenseTexts(directory, componentName) {
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && LICENSE_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  if (!files.length) throw new Error(`${componentName}: no license or notice text found`);
  return files.map((file) => {
    const text = fs.readFileSync(path.join(directory, file), 'utf8');
    if (!text.trim()) throw new Error(`${componentName}: ${file} is empty`);
    return { file, text };
  });
}

function packageComponent(directory, expectedName) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const name = manifest.name || expectedName;
  const license = licenseExpression(manifest);
  if (!license) throw new Error(`${name}: license metadata is missing`);
  if (!manifest.version) throw new Error(`${name}: version metadata is missing`);
  return {
    name,
    version: manifest.version,
    license,
    texts: licenseTexts(directory, name),
  };
}

function generateManifest(rootDir) {
  const lockPath = path.join(rootDir, 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  if (!lock.packages || !lock.packages['node_modules/electron']) {
    throw new Error('package-lock.json must include Electron');
  }

  const components = [];
  const productionPackages = Object.entries(lock.packages)
    .filter(([location, entry]) => location.startsWith('node_modules/') && entry.dev !== true)
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [location, entry] of productionPackages) {
    const directory = path.join(rootDir, location);
    if (!fs.existsSync(directory)) {
      if (entry.optional) continue;
      throw new Error(`${location}: production package is not installed`);
    }
    components.push(packageComponent(directory, entry.name || path.basename(location)));
  }

  const electronDirectory = path.join(rootDir, 'node_modules/electron');
  const electron = JSON.parse(fs.readFileSync(path.join(electronDirectory, 'package.json'), 'utf8'));
  const electronDist = path.join(electronDirectory, 'dist');
  const chromiumNotices = path.join(electronDist, 'LICENSES.chromium.html');
  if (!fs.existsSync(chromiumNotices)) throw new Error('Electron Chromium license notices are missing');
  const electronLicensePath = path.join(electronDist, 'LICENSE');
  if (!fs.existsSync(electronLicensePath)) throw new Error('Electron license text is missing');
  const electronLicenseText = fs.readFileSync(electronLicensePath, 'utf8');
  if (!electronLicenseText.trim()) throw new Error('Electron license text is empty');
  components.unshift({
    name: 'Electron',
    version: electron.version,
    license: licenseExpression(electron),
    texts: [{ file: 'LICENSE', text: electronLicenseText }],
  });
  if (!components[0].license || !components[0].texts.length) {
    throw new Error('Electron license metadata or text is missing');
  }
  components.splice(1, components.length - 1, ...components.slice(1).sort((a, b) => a.name.localeCompare(b.name)));

  return {
    schemaVersion: 1,
    chromiumNotices: 'LICENSES.chromium.html',
    components,
  };
}

function writeManifest(rootDir = __dirname, outputPath = path.join(rootDir, 'build', 'third-party-licenses.json')) {
  const manifest = generateManifest(rootDir);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(manifest), { encoding: 'utf8', flag: 'w' });
  fs.renameSync(temporaryPath, outputPath);
  return manifest;
}

if (require.main === module) {
  const manifest = writeManifest();
  console.log(`Generated third-party licenses for ${manifest.components.length} components`);
}

module.exports = { generateManifest, writeManifest };