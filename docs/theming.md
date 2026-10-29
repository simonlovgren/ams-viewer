# Theming

## Status and scope

Normative version-1 contract for T19, D51/D52 and UI-002/003/UI-024 through UI-029. Stages 1-3 are complete: both built-in JSON palettes, shared validation/application, full runtime color/font tokenization and saved selection are implemented. The current dark appearance remains unchanged, apart from alpha values rounded to the nearest 8-bit value. Import/export/deletion and the Settings chooser remain pending in stages 4-5; stage 3 introduces no temporary toggle.

Themes control application colors and font families, including chart SVG, dialogs, notifications, loading overlays, splash and Electron window backgrounds. They do not change spacing, sizes, layout, font size, animation or source-ad content. Native operating-system window decorations and file dialogs remain system-controlled.

The built-ins are `ams-dark` (initial default, preserving the existing appearance) and `ams-light`. Neither can be deleted or replaced. Both can be exported as a starting point for a renamed custom theme. Theme and font-mode preferences are application-wide, not dataset-specific.

## File contract

Each JSON file is a complete theme, not a partial override. Exactly these top-level properties are accepted:

| Option | Value | Effect |
|---|---|---|
| `schemaVersion` | Integer `1` | Selects this exact contract. Unsupported versions are rejected. |
| `name` | String, trimmed, 1-80 characters; no control characters | Display name in Settings, chooser and exported file. Names must be unique case-insensitively; built-in names are reserved. Never used as an internal storage path. |
| `colorScheme` | `dark` or `light` | Native form-control and scrollbar appearance; not inferred from background colors. |
| `colors` | Object containing every token listed below | Supplies literal colors mapped to allowlisted CSS custom properties. No extra keys. |
| `fonts` | Object with exactly `default` and `monospace` | Supplies the two local font-family stacks below. |

Imports are UTF-8 `.json` files no larger than 64 KiB. Reject invalid JSON, duplicate object keys, wrong types, missing/unknown keys and unsupported versions. Colors accept only `#RRGGBB` or `#RRGGBBAA`; the final pair is alpha. Transparent effects use alpha values, not CSS expressions. Reject CSS functions, references, URLs, declarations and executable content. Required opaque text/surface colors must have alpha `FF` or no alpha; translucent tokens are explicitly noted below.

Metadata and font syntax example (incomplete: add every color token before importing):

```json
{
  "schemaVersion": 1,
  "name": "my-theme",
  "colorScheme": "dark",
  "colors": {},
  "fonts": {
    "default": "\"Inter\", \"Segoe UI\", system-ui, sans-serif",
    "monospace": "\"JetBrains Mono\", \"Fira Code\", \"DejaVu Sans Mono\", ui-monospace, monospace"
  }
}
```

## Color reference

All tokens are required. JSON camelCase names map mechanically to `--theme-kebab-case` CSS properties, for example `textPrimary` becomes `--theme-text-primary`. Gradients, geometry and fixed animation opacity remain application code; their color stops come from these tokens. No raw theme CSS is inserted.

### Surfaces, text and borders

| Token | Affects |
|---|---|
| `background` | Main canvas and initial main/splash window background. |
| `backgroundTint` | Decorative radial background tint; alpha allowed. |
| `sidebarBackground` | Navigation, filter/statistics columns, toolbars and dialog surface. |
| `surface` | Result rows, cards, inputs, notices and chart tooltip dots. |
| `surfaceHover` | Hovered rows, secondary buttons and raised controls. |
| `border` | Main borders, dividers, input edges and tree hierarchy lines. |
| `borderSubtle` | Shortcut-list separators; alpha allowed. |
| `textPrimary` | Main text, titles and control labels. |
| `textSecondary` | Filter labels, chips and shortcut descriptions. |
| `textMuted` | Secondary labels, counts, breadcrumbs and metadata. |
| `textDisabled` | Zero-count options, dimmed chart labels and splash footnote. |
| `textDisabledSecondary` | Secondary text inside zero-count chips. |
| `textDescription` | Ad description body text. |
| `textSelected` | Selected tree nodes, chips and keyword entries. |
| `scrollbarThumb` | Scrollbar thumb at rest. |
| `scrollbarThumbHover` | Hovered scrollbar thumb. |
| `logoImageBackground` | Backing surface behind employer logo images, not image pixels. |

### Accents and interactions

| Token | Affects |
|---|---|
| `accentPrimary` | Primary teal-family icons, focus outlines, active indicators and resize handles. |
| `accentSecondary` | Blue-family links. |
| `accentTertiary` | Purple-family control borders, hover accents and chart guides. |
| `accentQuaternary` | Pink-family secondary accents and OR-mode indicator. |
| `gradientStart` | First stop of brand/button/text/progress and timeline-line gradients. |
| `gradientSecond` | Second gradient stop. |
| `gradientThird` | Third gradient stop. |
| `gradientEnd` | Final gradient stop. |
| `textOnAccent` | Text/icons on gradient buttons, brand logo and employer placeholder. |
| `focusRing` | Input focus border. |
| `focusHalo` | Input focus shadow; alpha allowed. |
| `searchFocusHalo` | Keyword-entry focus shadow; alpha allowed. |
| `navigationSelectedStart` | Active navigation gradient start; alpha allowed. |
| `navigationSelectedEnd` | Active navigation gradient end; alpha allowed. |
| `treeSelectedStart` | Selected tree-node gradient start; alpha allowed. |
| `treeSelectedEnd` | Selected tree-node gradient end; alpha allowed. |
| `selectionStart` | Selected chip/keyword gradient start; alpha allowed. |
| `selectionEnd` | Selected chip/keyword gradient end; alpha allowed. |
| `dropTargetBackground` | Import drop target while files hover; alpha allowed. |
| `error` | Error notices, destructive actions and error text. |
| `statusExpired` | Expired-ad indicator. |
| `switchTrack` | Enabled monospace switch track. |
| `switchThumb` | Enabled switch thumb. Disabled switch uses textPrimary/sidebarBackground. |

### Semantic tags

Tag meaning remains stable (UI-004/LST-002): location teal, field blue, group purple, occupation pink and miscellaneous grey. Theme authors may adjust shades and contrast, not exchange these meanings. Validation checks syntax, not perceived hue.

| Token | Affects |
|---|---|
| `locationText` | Location tag text/icons. |
| `locationBackground` | Location tag fill; alpha allowed. |
| `locationBorder` | Location tag border; alpha allowed. |
| `fieldText` | Occupation-field tag text/icons. |
| `fieldBackground` | Occupation-field tag fill; alpha allowed. |
| `fieldBorder` | Occupation-field tag border; alpha allowed. |
| `groupText` | Occupation-group tag text/icons. |
| `groupBackground` | Occupation-group tag fill; alpha allowed. |
| `groupBorder` | Occupation-group tag border; alpha allowed. |
| `occupationText` | Occupation tag text/icons. |
| `occupationBackground` | Occupation tag fill; alpha allowed. |
| `occupationBorder` | Occupation tag border; alpha allowed. |
| `otherText` | Miscellaneous tag text/icons. |
| `otherBackground` | Miscellaneous tag fill; alpha allowed. |
| `otherBorder` | Miscellaneous tag border; alpha allowed. |

### Charts, highlights and overlays

| Token | Affects |
|---|---|
| `chartAxis` | Timeline baseline and tick marks. Grid uses border; labels use textMuted/textDisabled. |
| `chartArea` | Timeline area-gradient color; application retains current fade opacity. |
| `chartHighlight` | Current timeline hover marker. |
| `findMatchBackground` | All ad-find matches; alpha allowed. |
| `findCurrentBackground` | Current ad-find match fill and outline. |
| `findCurrentText` | Text of current ad-find match. |
| `statisticsOverlay` | Pending-statistics dimming surface; alpha allowed. |
| `dialogBackdrop` | Modal backdrop; alpha allowed. |
| `dialogShadow` | Modal shadow color; alpha allowed. |
| `progressShimmer` | Splash progress sweep; alpha allowed. |

Transparent gradient endpoints use the adjacent token at zero alpha. Structural `transparent`, `currentColor` and inherited colors are not additional theme options. Browser text selection and form controls use the selected colorScheme and operating-system defaults unless explicitly styled by the app.

## Font reference

| Option | Effect |
|---|---|
| `fonts.default` | Application text when the existing Monospace font switch is off. Also splash text. |
| `fonts.monospace` | Application text when that switch is on (initial default). |

Each value is a comma-separated font-family list, at most 512 characters. Accept quoted literal family names and unquoted family names/generic families; reject empty entries, control characters, escapes, CSS functions, declaration delimiters and CSS-wide keywords. The default stack must end in `sans-serif` or `serif`; the monospace stack must end in `monospace`. Validate against this limited grammar before setting an allowlisted property, never insert a stylesheet from user input. Font files are not bundled, imported or downloaded; unavailable local names fall through to the next family. Changing themes preserves the font-mode preference. Preview panels use their theme's stack for the current font mode.

## Selection, storage and file operations

- Settings has a separate Theme section with the active name as a button. It opens a scrollable modal following UI-018 keyboard/focus behavior.
- Each panel has its own palette, font stack, name and small multi-color swatch. A distinct selection button occupies the panel body; adjacent download/trash buttons are siblings, never nested buttons. Enter/Space selects immediately and keeps the modal open. Mark selection with a visible check and an accessible state, not color alone.
- Every panel exports a complete theme through a native Save dialog. Built-in trash buttons are disabled with an accessible explanation. Import is a separate modal action using the native Open dialog.
- Import stores a validated copy, without applying it automatically or changing its original file. Reject duplicate names case-insensitively, including reserved built-in names. Rename an exported built-in before importing a derivative.
- Custom deletion requires an in-app confirmation initially focused on Cancel. Confirming deletion of the active custom theme selects ams-dark; cancellation changes nothing. Export/delete must not trigger panel selection.
- Bundle default files under `src/themes/ams-dark.json` and `src/themes/ams-light.json`. Store imported copies under `<userData>/themes/` with generated IDs, never user-supplied names as paths. Persist active ID separately in an application-wide theme catalog, not in dataset databases. Main process owns validation, bounded file access and atomic catalog writes; preload exposes only narrow theme operations.
- Persist selection before reporting success. Apply it before first paint on subsequent startup, including splash and window backgrounds. Invalid/missing custom selection falls back to ams-dark with a dismissible warning. Corrupt custom files must not prevent startup or remove unrelated valid themes.
- Errors use existing in-app dialogs/notices. Native file dialogs are only for selecting input/output paths. No remote assets, new framework, database migration or dataset reset is required.

### Implemented selection storage (stage 3)

`<userData>/themes.json` currently contains exactly `{ "version": 1, "activeId": "ams-dark" }`, with `activeId` restricted to `ams-dark` or `ams-light`. A missing file means the default dark theme without a warning. A corrupt, oversized, unsupported or unavailable selection falls back to ams-dark and reports a dismissible top warning; the original file is retained until a successful explicit selection replaces it. This catalog is separate from the theme-file schema and dataset catalog. Stage 4 will extend it for imported themes with backwards-compatible handling of this stage-3 format.

Main loads and validates both bundled themes and reads selection before creating either window. `theme:current` serves only the in-memory snapshot to preloads. `themes:list` reports built-in metadata and active ID; `themes:activate` accepts only a built-in ID from the main window, serializes concurrent requests, writes a private temporary catalog and atomically renames it before changing active state. A failed save leaves the prior in-memory selection intact and shows an error notice. Successful activation updates native window backgrounds and sends `theme:changed` to both renderers, applying properties without reloading or touching navigation, filters, draft text, focus, scroll or font-mode settings.

Until stage 5 supplies the chooser, development checks can call `await window.api.activateTheme('ams-light')` or `await window.api.activateTheme('ams-dark')` in the Electron renderer's DevTools. This is not a user-facing selector. Theme selection never follows dataset switching and is not stored in `localStorage`; the existing monospace preference still is.

## Compatibility and maintenance

Version 1 rejects partial themes and unknown keys rather than silently mixing incompatible palettes. Any incompatible token/name/type change requires a schemaVersion increment and an explicit migration or documented rejection/recovery path for existing custom themes. Default files, executable validation and reference must stay synchronized; do not silently drop imported values. The shared validator/application is in `src/shared/theme.js`; `src/shared/theme.test.js` checks exact reference/default/consumer coverage, and `src/main/theme-catalog.test.js` checks both default key sets, contrast, persisted selection, recovery and live updates.

Every added, modified or removed color/font token must update this reference, validation contract, both built-in theme files and regression tests in the same change. AGENTS.md and the developer agent enforce this rule. Built-in palettes require visual contrast/readability checks; arbitrary custom palette contrast cannot be guaranteed by syntax validation.

## Staged verification

1. Contract: validate documentation links, JSON example syntax, unique requirement/token IDs and explicit stage status. No runtime change.
2. Tokenization: introduce shared validation/application and ams-dark; test exact token coverage and dark parity across CSS, SVG, splash and windows. Keep existing suite passing.
3. Light/persistence: add ams-light, enforce identical default key sets, validate both fonts, test recovery/restart and no context reset; verify light contrast and controls.
4. Library: test isolated temporary-directory import/export/deletion, reserved and duplicate names, malformed/oversized files, unsafe values, cancellation, failure atomicity and corruption recovery.
5. Chooser: test selection, independent actions, keyboard/focus restoration and theme/font previews. Review screenshots at 960x600 and 1400x900, both built-ins and both font modes; smoke-test Electron with disposable userData.

Stop between stages for review. If an existing test fails, follow AGENTS.md approval rule before modifying that test.

Stage 2 verification (2026-10-29): all 76 tests and changed-JS syntax/editor checks pass. Browser old/new CSS comparison passes all 16 view/size/font cases for computed colors, typography and geometry, allowing alpha quantization up to 0.004; SVG gradient stops match the original palette. Four additional shortcut-modal size/font cases verify fit and surface/backdrop/shadow/focus parity. Desktop Search and minimum-size Ad screenshots reviewed. Disposable Electron startup and native main/splash inspection confirm ams-dark, expected backgrounds and all 67 color/font properties. Native startup reached the main window in 629 ms. Native user interaction, normal quit and visual observation of startup flashing remain unverified; diagnostic sessions were forcibly terminated. Live datasets were untouched.

Stage 3 verification (2026-10-29): all 83 tests pass, including temporary-directory restart/recovery/write-failure and main IPC ordering tests. Light text/tag/gradient contrast checks pass at 4.5:1 for the tested combinations. Browser checks pass 32 view/size/theme/font cases and eight modal cases; live changes preserve filters, draft text, focus, history, scroll and font preference, and reload restores light mode. Light desktop Search and minimum-size Ad/highlight screenshots reviewed. Three disposable native launches verify saved light in both windows, live dark switching with unchanged context, persisted dark after normal quit/relaunch, font-mode retention and visible corrupt-catalog recovery. Each launch exited normally; windows appeared in 476-606 ms. No live datasets changed. Visual observation of startup flashing and full-dataset theme interaction remain unverified; custom-theme operations and chooser are not implemented yet.