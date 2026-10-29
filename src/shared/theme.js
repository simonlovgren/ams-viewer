(function (root) {
  'use strict';

  const colorTokens = `background backgroundTint sidebarBackground surface surfaceHover border borderSubtle
    textPrimary textSecondary textMuted textDisabled textDisabledSecondary textDescription textSelected
    scrollbarThumb scrollbarThumbHover logoImageBackground accentPrimary accentSecondary accentTertiary accentQuaternary
    gradientStart gradientSecond gradientThird gradientEnd textOnAccent focusRing focusHalo searchFocusHalo
    navigationSelectedStart navigationSelectedEnd treeSelectedStart treeSelectedEnd selectionStart selectionEnd
    dropTargetBackground error statusExpired switchTrack switchThumb
    locationText locationBackground locationBorder fieldText fieldBackground fieldBorder groupText groupBackground groupBorder
    occupationText occupationBackground occupationBorder otherText otherBackground otherBorder
    chartAxis chartArea chartHighlight findMatchBackground findCurrentBackground findCurrentText
    statisticsOverlay dialogBackdrop dialogShadow progressShimmer`.split(/\s+/);
  const translucent = new Set(`backgroundTint borderSubtle focusHalo searchFocusHalo navigationSelectedStart navigationSelectedEnd
    treeSelectedStart treeSelectedEnd selectionStart selectionEnd dropTargetBackground locationBackground locationBorder
    fieldBackground fieldBorder groupBackground groupBorder occupationBackground occupationBorder otherBackground otherBorder
    findMatchBackground statisticsOverlay dialogBackdrop dialogShadow progressShimmer`.split(/\s+/));

  function exactKeys(value, keys, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) {
      throw new Error(`${label} must contain exactly: ${keys.join(', ')}`);
    }
  }

  function validateFont(value, fallback, label) {
    if (typeof value !== 'string' || value.length > 512 || /[\x00-\x1f\x7f-\x9f\\;:{}()<>]/.test(value)) {
      throw new Error(`Invalid ${label} font stack`);
    }
    const family = '(?:"[^"\\x00-\\x1f]+"|\'[^\'\\x00-\\x1f]+\'|[a-zA-Z][a-zA-Z0-9 -]*)';
    if (!new RegExp(`^\\s*${family}(?:\\s*,\\s*${family})*\\s*$`).test(value)) throw new Error(`Invalid ${label} font stack`);
    const families = value.split(',').map((entry) => entry.trim());
    if (families.some((entry) => /^(inherit|initial|unset|revert|revert-layer)$/i.test(entry))
      || !fallback.includes(families.at(-1))) throw new Error(`Invalid ${label} font fallback`);
  }

  function validate(theme) {
    exactKeys(theme, ['schemaVersion', 'name', 'colorScheme', 'colors', 'fonts'], 'Theme');
    if (theme.schemaVersion !== 1) throw new Error('Unsupported theme schemaVersion');
    if (typeof theme.name !== 'string' || !theme.name.trim() || theme.name !== theme.name.trim()
      || theme.name.length > 80 || /[\x00-\x1f\x7f-\x9f]/.test(theme.name)) throw new Error('Invalid theme name');
    if (!['dark', 'light'].includes(theme.colorScheme)) throw new Error('Invalid theme colorScheme');
    exactKeys(theme.colors, colorTokens, 'Theme colors');
    for (const token of colorTokens) {
      const color = theme.colors[token];
      if (typeof color !== 'string' || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(color)
        || (!translucent.has(token) && color.length === 9 && color.slice(-2).toLowerCase() !== 'ff')) {
        throw new Error(`Invalid theme color: ${token}`);
      }
    }
    exactKeys(theme.fonts, ['default', 'monospace'], 'Theme fonts');
    validateFont(theme.fonts.default, ['sans-serif', 'serif'], 'default');
    validateFont(theme.fonts.monospace, ['monospace'], 'monospace');
    return theme;
  }

  function parse(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > 65536) throw new Error('Theme exceeds 64 KiB');
    const theme = JSON.parse(text);
    const stack = [];
    for (const match of text.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\]]/g)) {
      const token = match[0];
      if (token === '{') stack.push(new Set());
      else if (token === '[') stack.push(null);
      else if (token === '}' || token === ']') stack.pop();
      else if (/^\s*:/.test(text.slice(match.index + token.length))) {
        const key = JSON.parse(token);
        if (stack.at(-1).has(key)) throw new Error(`Duplicate theme key: ${key}`);
        stack.at(-1).add(key);
      }
    }
    return validate(theme);
  }

  const property = (token) => `--theme-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

  function apply(theme, element) {
    validate(theme);
    for (const token of colorTokens) element.style.setProperty(property(token), theme.colors[token]);
    element.style.setProperty('--theme-font-default', theme.fonts.default);
    element.style.setProperty('--theme-font-monospace', theme.fonts.monospace);
    element.style.setProperty('color-scheme', theme.colorScheme);
    element.dataset.theme = theme.name;
  }

  const api = Object.freeze({ colorTokens: Object.freeze(colorTokens), validate, parse, property, apply });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.amsTheme = api;
})(globalThis);