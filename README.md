# AMS Viewer

Desktop app for browsing historical Swedish job ads (Arbetsförmedlingen / JobTech open data). Import one or more JSONL files, then search and filter by keyword, occupation, location, date and more, and read ads in a job-ad style view.

## Using the app

1. Start the app (see below).
2. Open **Datasets** in the side menu and click **Choose files…** (or drag and drop). Select one or more `.jsonl`, `.ndjson` or `.json` files. A quarter-sized file (~130k ads, ~770 MB) imports in roughly half a minute.
3. Go to **Search ads**. Filter with the left panel, search by keyword at the top, click an ad to open it.

| Action | How |
|---|---|
| Back / forward | Backspace, mouse back/forward buttons, Alt+← / Alt+→, or the back button in the ad view |
| Focus keyword search | `/` |
| Jump to a filter from an ad | Click a tag or breadcrumb item |
| Remove imported data | Datasets → Remove |

Filters are remembered when you open an ad and when you restart the app. Data is stored locally in `~/.config/AMS Viewer/ads.db` (macOS: `~/Library/Application Support/AMS Viewer/`, Windows: `%APPDATA%\AMS Viewer\`); the source files are not needed after import.

## Running as a developer

Requirements: Node.js 22.5+ and npm (Electron 44 bundles Node 24 with `node:sqlite`; no native modules to build).

```bash
npm install
npm start               # add --no-sandbox if the Electron sandbox helper is missing
node --check src/renderer/app.js
```

### Project layout

```
src/main/       Electron main process: main.js, preload.js, db.js, import-worker.js, read-worker.js, splash-preload.js
src/renderer/   UI: index.html, styles.css, app.js (plain JS, no build step)
requirements/   Requirements with IDs (what the app shall do)
docs/           System description, technologies, design decisions, constraints, data model
AGENTS.md       Rules for working in the project (also used by the Copilot agent)
```

### Working with the project

- Every change traces to a requirement ID in [requirements/](requirements/README.md). Add one if none fits.
- Record major decisions in [docs/design-decisions.md](docs/design-decisions.md) with a `**Requirements**:` line.
- Keep docs and requirement statuses current in the same change. Details: [AGENTS.md](AGENTS.md).
- Source data files and the database must not be committed.

### Inspecting the database

```bash
node --no-warnings -e "
const d=require('./src/main/db');
const db=d.open(process.env.HOME+'/.config/AMS Viewer/ads.db');
console.log(d.info(db), d.search(db,{q:'sjuksköterska'},0,5,true));"
```

## Building for distribution

Packaging uses [electron-builder](https://www.electron.build/), configured in the `build` section of `package.json`. Only `src/**` and `package.json` are bundled, so data files in the project folder are never included. Output goes to `dist/`.

```bash
npm install
npm run pack    # unpacked app for quick testing: dist/linux-unpacked/ (or win-/mac- equivalent)
npm run dist    # installers for the current platform
```

| Platform | Target | Build on |
|---|---|---|
| Linux | AppImage | Linux |
| Windows | NSIS installer | Windows (or Linux with Wine) |
| macOS | dmg | macOS |

Release checklist:

1. Update `version` in `package.json`.
2. Confirm related requirements and docs are current (see [AGENTS.md](AGENTS.md)).
3. Run `npm run pack` and launch the result; open Datasets, import a small file, search, open an ad.
4. Run `npm run dist` on each target platform and distribute the files from `dist/`.

Current state and limits: only the unpacked Linux build has been tried (it starts); AppImage, Windows and macOS targets are untested, and there is no code signing, custom icon or auto-update (see [docs/constraints.md](docs/constraints.md), requirement NFR-009).

## Documentation

- [docs/README.md](docs/README.md): system description, technologies, design decisions, constraints, data model
- [requirements/README.md](requirements/README.md): requirement index and format
