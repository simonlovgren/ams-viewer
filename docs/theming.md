# Theming

## Status and scope

Normative version-1 contract for completed T19, D51-D54 and UI-002/003/UI-024 through UI-029. Both built-in palettes, validation/application, full runtime tokenization, persisted selection, custom-library file operations and Settings chooser are implemented. The current dark appearance remains unchanged, apart from alpha values rounded to the nearest 8-bit value.

Open Settings > Appearance and press the current theme name on the first row. Select a panel to apply it immediately; the chooser stays open. Import theme adds a validated copy without selecting it. Each panel has independent download/remove icons; built-ins cannot be removed. The 450 px Settings column uses a compact 30 px theme-name button on the right, matching the monospace control's alignment. Font mode remains independent.

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
| `accentPrimary` | Primary teal-family icons, focus outlines, active indicators, resize handles and splash Open dataset button. |
| `accentSecondary` | Blue-family links. |
| `accentTertiary` | Purple-family control borders, hover accents and chart guides. |
| `accentQuaternary` | Pink-family secondary accents and OR-mode indicator. |
| `gradientStart` | First stop of brand/button/text/progress and timeline-line gradients. |
| `gradientSecond` | Second gradient stop. |
| `gradientThird` | Third gradient stop. |
| `gradientEnd` | Final gradient stop. |
| `textOnAccent` | Text/icons on gradient buttons, brand logo and employer placeholder. |
| `focusRing` | Input focus border and splash chooser/control keyboard focus outlines. |
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

- Theme is the first row in Settings > Appearance, with the label on the left and active-name button on the right instead of a toggle. It opens a scrollable modal following UI-018 keyboard/focus behavior (D54, user-revised placement).
- Each panel has its own palette, font stack, name and small multi-color swatch. A distinct selection button occupies the panel body; adjacent download/trash buttons are siblings, never nested buttons. Enter/Space selects immediately and keeps the modal open. Mark selection with a visible check and an accessible state, not color alone.
- Every panel exports a complete theme through a native Save dialog. Built-in trash buttons are disabled with an accessible explanation. Import is a separate modal action using the native Open dialog.
- Import stores a validated copy, without applying it automatically or changing its original file. Reject duplicate names case-insensitively, including reserved built-in names. Rename an exported built-in before importing a derivative.
- Custom deletion requires an in-app confirmation initially focused on Cancel. Confirming deletion of the active custom theme selects ams-dark; cancellation changes nothing. Export/delete must not trigger panel selection.
- Bundle default files under `src/themes/ams-dark.json` and `src/themes/ams-light.json`. Store imported copies under `<userData>/themes/` with generated IDs, never user-supplied names as paths. Persist active ID separately in an application-wide theme catalog, not in dataset databases. Main process owns validation, bounded file access and atomic catalog writes; preload exposes only narrow theme operations.
- Persist selection before reporting success. Apply it before first paint on subsequent startup, including splash and window backgrounds. Invalid/missing custom selection falls back to ams-dark with a dismissible warning. Corrupt custom files must not prevent startup or remove unrelated valid themes.
- Errors use existing in-app dialogs/notices. Native file dialogs are only for selecting input/output paths. No remote assets, new framework, database migration or dataset reset is required.

### Implemented library storage (stage 4)

`<userData>/themes.json` accepts the stage-3 `{ "version": 1, "activeId": "ams-dark" }` format unchanged. When custom themes exist it adds `themes`, an array of `{ "id": "theme-<generated UUID>", "name": "Display name" }`. The active ID can identify either built-in or a registered custom theme. Theme copies live at `<userData>/themes/<id>.json`; imported names never determine paths. Empty libraries omit the optional array. Catalog and each theme file have a 64 KiB limit; files must be regular files and valid UTF-8, and theme file symlinks are rejected. The custom storage directory must not be a symlink.

A missing catalog defaults silently to dark. An invalid catalog or unavailable active selection falls back with a dismissible warning; damaged files are not overwritten during recovery. Missing/corrupt custom files remain listed with an error and no preview, while unrelated valid themes continue loading. Their names stay reserved until removed. Known IDs are the only way to activate, export or remove stored themes; unavailable entries can be removed. Activation/export revalidate the stored custom file.

All library mutations and exports share a serialized queue. Import validates first, rejects duplicate/reserved names case-insensitively, writes a private generated-ID copy and commits metadata atomically; failure rolls back the new copy. Import never applies automatically or changes its source file. Removal renames the owned copy to `.json.removing`, commits catalog removal and any active fallback, then deletes the staged file. Commit failure restores the file; startup restores stages still registered and cleans stages no longer registered. Crash-orphaned, unregistered import copies are inert and never loaded automatically. No dataset data changes.

Export serializes a complete validated copy using atomic replacement at the chosen Save path. Destinations inside application userData or the bundled `src/` directory are refused to prevent overwriting catalogs, stored themes or defaults. A safe generated ID supplies the suggested filename, not the theme name. Native Save-dialog overwrite approval applies to existing external destinations. Built-ins can be exported but cannot be removed or replaced by import.

Main loads built-ins and selection before either window exists; `theme:current` still returns only the in-memory snapshot. `themes:list` now returns active ID and entries containing `id`, `name`, `builtIn`, `colorScheme`, validated `theme` preview data or `error`. `themes:activate` accepts a known ID from the main window, persists before updating native backgrounds and broadcasting `theme:changed`. The new `themes:import` and `themes:export` handlers obtain paths only from native Open/Save dialogs; renderer IPC accepts no arbitrary input/output paths. `themes:delete` accepts only an ID. File operations show existing application-wide progress/error notices and always end running feedback, including cancellation.

Renderer `importThemeFile`, `exportThemeFile` and `removeTheme` helpers provide error dialogs and a shared duplicate-work guard for the chooser. Removal first uses UI-018's in-app confirmation with Cancel focused; cancel/Escape sends no delete IPC. The main process independently protects built-ins, but assumes a custom deletion request came from that confirmed renderer workflow, like existing source/dataset removal. DevTools callers invoking `window.api.deleteTheme(id)` bypass the renderer confirmation and must do so intentionally.

Development checks can also call `window.api.themes()`, `window.api.activateTheme(id)`, `window.api.importTheme()` and `window.api.exportTheme(id)` in Electron renderer DevTools. Normal users use the Appearance chooser. Selection remains independent of datasets and the monospace preference.

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

Stage 4 verification (2026-10-29): all 93 tests and changed-file syntax/editor checks pass. Temporary-directory regressions cover custom round trips, legacy catalog compatibility, invalid/oversized/non-UTF-8/symlink input, duplicate JSON keys, reserved/case-duplicate names, protected exports, concurrent imports, rollback, corrupt/missing-file isolation and staged-deletion recovery. IPC tests cover native-dialog cancellation, sender restrictions, progress/error cleanup and fallback broadcasts; renderer tests cover confirmation/cancellation, built-in protection, duplicate work and failures. Two disposable Electron launches verify imported-theme startup in both windows, preview data, built-in deletion rejection, active deletion fallback and persistent dark restart, both with normal exits (510-618 ms). Source import files and live datasets remained unchanged. Native Open/Save interaction, chooser layout/keyboard workflow, startup flashing and full-dataset interaction remain unverified; chooser is stage 5.

Stage 5 verification (2026-10-29): all 98 tests pass, including chooser preview escaping, protected/unavailable actions, isolated panel/file clicks, focus restoration, errors, duplicate work, stale opening replies and final Appearance placement. Browser Enter/Space selection, export isolation, cancel/confirm removal, import success/cancel/failure, Tab containment, Escape/close restoration and blocked background shortcuts pass with mocked file operations. Eight chooser size/theme/font geometry cases pass, including long names and unavailable entries; 12 Appearance-row cases confirm right alignment and wrapping. Minimum-size light chooser and Settings screenshots reviewed. Two disposable native launches verify chooser selection, protected controls, confirmation/cancel/removal, trigger-focus restoration, 450 px Settings width/30 px button, and theme/font retention after normal restart (549-594 ms); native controls were driven through DevTools DOM interaction. Live data/source files unchanged. Physical native keyboard, actual OS Open/Save dialogs, visual startup-flash observation and full-dataset interaction remain unverified; these caveats do not imply missing chooser functionality.