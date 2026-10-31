# Testing recipes

Count logic has headless regression tests; visual layout still needs manual review.

## Live import file list (DAT-013 / D63)
2026-10-31 D64: `node --test --test-name-pattern='file insertion precedes|import completion and source removal|datasets table and live import' src/main/db.test.js src/renderer/app.test.js` checks 2,001 reference inserts complete before enrichment, live older-source counters and matching summary projections from a separate connection across commits, duplicate re-import reconciliation, phase labels and targeted `sources-updated` refreshes. Complete `node --test` passes 131 tests. Fixtures use disposable databases; native visuals/full-scale timing are unverified. Preserve the import notice's `newly enriched ads in this file` wording; existing coverage checks this contract.
`node --test --test-name-pattern='import completion and source removal refresh datasets in place|source removal requires confirmation' src/renderer/app.test.js` covers targeted table/totals refresh at file completion, import completion and removal, while asserting the Datasets view and progress panel remain mounted. `node --check src/renderer/app.js && node --check src/renderer/app.test.js && node --test` passes the complete Node suite. Native import interaction and visual behavior remain unverified.

## Latest import statistics (DAT-014 / D61)
`node --test --test-name-pattern='source import-stat migration|import metrics include|legacy enrichment backfills|manual reprocessing restores|import duration|datasets table and live import' src/main/db.test.js src/renderer/app.test.js` covers nullable legacy import metrics, static enrichment-count initialization and transitions across import order, conflicts, source removal and reprocessing, duration formatting and table/progress rendering. The complete suite passes 126 tests (2026-10-31). A browser visual check was unavailable because the shared local server refused connections; full-scale initialization/import overhead is unmeasured.

## Ad source inspection (AD-012, D60)
`node --test --test-name-pattern='ad source|source route|source view shares|source JSON find' src/main/db.test.js src/main/dataset-catalog.test.js src/renderer/app.test.js` covers immutable source/additions-only responses, ID-less ads, taxonomy array positions, sender/ID/dataset validation, page-icon/header rendering, escaped pretty-print/highlighting, hidden empty-enrichment panels, all Back inputs, forward/history/list-scroll retention, shared find shortcuts, JSON match cycling/clearing, missing ads, stale replies and recoverable read failures.

2026-10-31: browser checks passed eight 1400x900/960x600 cases across both built-in themes and font modes, including header-matched panel widths, wrapped long strings, visible find controls without overflow and breadcrumb return. Browser keyboard checks passed `/`, Enter/Shift+Enter and Escape with matches in both panels and syntax spans preserved. Disposable native `npm start` passed real source IPC, additions-only data, page-button navigation, both-panel find and breadcrumb Back, then exited normally (0). Live data untouched; physical native keyboard/mouse buttons not manually verified. Seed summaries and call `catalog.markInitialized('default')` before native startup; the path helper is `catalog.databasePath()`, not `dbPath()`.

Integrated browser's request API may fail with `Storage.getCookies: Method not found`; app CSP correctly blocks in-page theme fetches. For fixture-only palette loading, navigate to the served theme JSON, parse the body's text, then return to the renderer; do not relax application CSP.

## Legacy taxonomy and location enrichment (DAT-015/016, D58)
2026-10-31 UI-031/D62: `node --test src/main/db.test.js src/main/dataset-catalog.test.js src/renderer/app.test.js` passes 102 tests. Focused progress checks use `--test-name-pattern='enrichment progress|import enrichment|enrichment notices|manual reprocessing'`. Covers 502-ad backfill with a mocked clock for throttled mid-loop updates, taxonomy/location counting once, live reference-import counts, child-notice stacking/update/resume/error cleanup, and the unchanged monotonic overall reprocessing contract. Fixtures use temporary databases only; full-scale performance and native visual appearance remain unverified.

`node --check src/main/db.js && node --check src/main/import-worker.js && node --test src/main/db.test.js` covers retryable key/map backfill, reference-first and legacy-first import, duplicate-safe contributions, preserved source values/raw JSON, taxonomy and independent location consensus, conflict removal, reprocessing, and summary/facet consistency. Worker fixtures use temporary databases and files only. Do not validate the one-time migration against the live 11.25M-ad database without explicitly planning its write cost; full-scale time/disk use is not measured.

D59 detail regression: `node --test --test-name-pattern='legacy enrichment|ad details enrich' src/main/db.test.js` covers detail/list consistency, preserved source fields and taxonomy shapes, immutable stored JSON, and detail rollback after reference conflicts/removal. `getAd()` returns a presentation projection, not an exact raw-record snapshot; read `ads.raw` directly when asserting source immutability.

2026-10-31 D59: `node --check src/main/db.js && node --check src/main/db.test.js && node --test src/main/db.test.js src/renderer/app.test.js` passes 77 tests. Disposable worker import of `devdata/2006-min.jsonl` and `devdata/2026-Q3-min.jsonl` stores 1,991 ads. The "Jobba i Norge med Manpower Helse!" example matches its listing/filter taxonomy and renders all three hierarchy labels in tags and breadcrumbs using the real `renderAd()` headlessly. VM fixtures must include the `fmtText`/`fact`/`labels` helper block, not only `renderAd`. Native visual layout was not inspected.

Disposable startup smoke test (Linux):
```bash
temp_config=$(mktemp -d)
trap 'rm -rf "$temp_config"' EXIT
XDG_CONFIG_HOME="$temp_config" timeout 12s npm start -- --no-sandbox
```
Window displayed in 522 ms and empty-dataset startup completed. Timeout termination may emit the known Electron GPU/SIGTRAP shutdown noise; this is not a clean-quit check. Live dataset untouched.

## Third-party licenses (NFR-011 / UI-030 / D56 / D57)
`node --check src/renderer/app.js && node --test src/main/generate-licenses.test.js src/main/third-party-licenses.test.js src/renderer/app.test.js` passes 62 tests. Covers production versus dev-only dependencies, multiple license/notice files, missing-license failures, Electron resource layouts, inert Chromium parsing, safe text rendering, the Settings entry button, lazy loading, Back, sidebar selection and retained list scroll. License texts have no frames or independent overflow.

`npm run licenses` generates `build/third-party-licenses.json`; `npm run pack` additionally verifies electron-builder copies it to `dist/linux-unpacked/resources/third-party-licenses.json`. The bundled `LICENSES.chromium.html` is at `dist/linux-unpacked/` on Linux, adjacent to `resources/`; do not copy it into the manifest. The real report has 779 projects and is about 20 MB.

Browser fixtures must apply complete built-in theme color/font tokens, not just `{name: 'ams-dark'}` or a no-op `amsTheme.apply`; otherwise geometry can pass with unstyled default fonts/colors. Copy only headings and license `textContent` out of the inert template; never attach its source nodes.

2026-10-31 D57: browser fixture with the real 779-project Chromium report passes eight cases (960x600/1400x900, both built-in palettes/fonts): no horizontal overflow, no nested scrollbars, last notice reachable and Back returns Settings. Styled screenshot reviewed. Electron package text is a fixture; native interaction remains unverified.

## Theme contract and dark parity (T19 / D51)
Stage 5 (D54): the full command below passes 98 tests. Chooser fixtures test escaped previews, matching fonts/colors, protected/unavailable actions, independent panel/select/export/delete routes, stale opening responses, duplicate work, errors, focus retention and final Appearance-row markup/compact dimensions. Browser checks cover native Enter/Space/Escape, Tab containment, blocked background shortcuts/mouse navigation, import success/cancel/error and confirmed/canceled deletion with mocked file operations. Eight chooser geometry cases and 12 Appearance-row cases cover both sizes/themes/fonts plus long names; screenshots reviewed. Final layout is 450 px Settings content and a 30 px theme-name button.

Two final native launches (549-594 ms) exercised chooser controls, safe cancellation/removal, close-trigger focus and saved theme/font restoration through DevTools DOM interaction; both exited normally. MutationObserver alone cannot wait for focus-only transitions: observe focusin too, or poll with the browser tool. Native DevTools key dispatch did not activate controls on this setup; physical native keyboard remains unverified, while browser keyboard checks passed. Actual OS Open/Save dialog interaction remains unverified; library/IPC and mocked browser round trips are covered. Live data/source files untouched.

Stage 4 (D53): `node --test src/shared/theme.test.js src/main/theme-catalog.test.js src/main/dataset-catalog.test.js src/main/db.test.js src/renderer/app.test.js` passes 93 tests. Library tests use temporary directories only, covering import/export round trips, malformed/oversized/invalid-UTF-8/symlink input, duplicate JSON keys/names, built-in/export protection, atomic rollback, missing/corrupt entries, interrupted removal and concurrent imports. IPC stubs test Open/Save cancellation, sender authorization, feedback cleanup and deletion broadcasts. Renderer tests cover confirmation/cancellation/error handling and duplicate-work guards; chooser controls are not yet wired.

Two disposable native launches verified imported light-palette startup in both windows, full preview snapshots via themes:list, built-in rejection, active deletion fallback and dark restart with normal quits (510-618 ms). Native file-dialog interaction remains unverified. An initial empty-fixture run hit a startup `database is locked` error; pre-create fixture schema/summaries with db.open/ensureSummary/close and mark that disposable dataset initialized before launching, to avoid simultaneous first-open DDL in workers. Do not change DB code or touch the live dataset for this fixture issue. Source theme files remained unchanged. Stage 5 should reuse importThemeFile/exportThemeFile/removeTheme helpers; direct api.deleteTheme bypasses renderer confirmation and is for intentional DevTools checks only.

Stage 3 (D52): include `src/main/theme-catalog.test.js` in the command below; all 83 tests pass. New coverage checks identical complete built-in contracts/fonts, light text/tag/gradient contrast, atomic selection persistence, corrupt/unavailable recovery, failed-write retention, serialized activation, main-window IPC authorization, save-before-broadcast and live font-mode preservation. Browser checks pass 32 view/size/theme/font cases plus eight modal cases; draft/filter/focus/history/scroll/font retention and reload restoration verified. Light desktop Search/minimum-size Ad screenshots reviewed.

Native stage-3 recipe: use disposable XDG_CONFIG_HOME, seed `<config>/AMS Viewer/themes.json` via `require('./src/main/theme-catalog').open(dataDir).activate('ams-light')`, then inspect both DevTools targets. Wait for DOMContentLoaded for property checks, and `[startup] window shown` before interaction. Sidebar navigation is async: after clicking Search, wait for view-list to lose `hidden` before recording focus/history. Otherwise navigation itself races the theme test. Three launches (light/live switch, dark restart, corrupt-catalog recovery) passed and exited normally; font mode survived. Use renderer `window.close()` to exercise the real close handshake, not `closeDecision(true)` without a pending request. Startup flashing/full-dataset interaction remain unverified. Live data untouched.

`node --test src/shared/theme.test.js src/main/dataset-catalog.test.js src/main/db.test.js src/renderer/app.test.js` passes 76 tests (2026-10-29). Theme tests enforce exact reference/JSON/consumer token sets, reject unsafe/incomplete values, duplicate keys and oversized JSON, verify font-mode preservation, both blocking head bootstraps and window background wiring. No existing tests were changed.

Browser fixtures must now provide `window.api.theme` (or `window.splash.theme`) from `src/themes/ams-dark.json` before head scripts execute. No fallback palette is embedded in CSS. Browser old/new CSS comparison passed 16 view/size/font cases, comparing computed colors, typography and geometry with 0.004 tolerance for hex-alpha quantization. SVG stops matched; desktop Search/minimum-size Ad screenshots reviewed.

Native disposable startup showed main in 629 ms; DevTools inspected ams-dark background and all 67 color/font properties in both windows. DevTools target navigation can arrive before `document.body` exists: await DOMContentLoaded before inspecting. A GPU-disabled diagnostic stalled before main display on this Wayland setup; use normal GPU configuration. Diagnostic runs were force-terminated, so normal quit/startup flashing/native interaction remain unverified. Native harnesses should spawn a detached process group and clean up the whole group; killing only the Electron parent can leave inherited pipes open. `closeDecision(true)` without a pending close request does not close the app. Live datasets were untouched.

## Full-height sidebars with notifications (UI-022 / D47)
2026-10-29: browser fixture passed 48 geometry cases: Search, Ad, Datasets and Settings at 1400x900 and 960x600, both fonts, with empty/stacked/cleared notices. Assert visible sidebar/main/view bottoms equal `innerHeight` and their tops equal the notification area's bottom. Empty notices must yield a zero-height first grid row; content stays in row 2. This catches the original 1400x900 regression (669 px content plus 231 px unused space).

Browser interaction checks passed menu/filter/statistics collapse, both sidebar pointer resizers, statistics keyboard resizing and long-ad scrolling in both fonts. All 45 renderer tests, renderer syntax and CSS editor checks passed. Disposable `npm start -- --no-sandbox` startup passed; native layout and interaction were not manually verified. Live datasets untouched.

## Filtered statistics loading feedback (UI-023 / D50)
`node --test --test-name-pattern='statistics overlays|superseded statistics|statistics failures|facet refresh|background tasks|statistics errors' src/renderer/app.test.js` covers independent widget completion, the counts-only tail, stale/absent/building replies, failures and superseded successes/failures. The new deferred fixtures use `setImmediate` to drain complete promise/finally chains, not a fixed number of microtask ticks.

2026-10-18: all 71 tests, changed-JS syntax/editor checks and disposable `npm start -- --no-sandbox` startup passed. Browser fixtures with held count/facet/timeline promises verified exact overlay/body bounds, spinner styling and text fit at 1400x900 and 960x600 in both fonts, collapse, keyboard resizing, top-notice push-down and persistence in Settings, independent overlay completion, count failure cleanup and error dismissal. Screenshots reviewed. Use `waitForFunction(..., { polling: 50 })` when waiting in the hidden browser; default animation-frame polling can time out even after the expected DOM appears. Live dataset untouched; native full-dataset interaction and latency not tested.

## Manual dataset reprocessing (DAT-026 / D49)
`node --test --test-name-pattern='reprocess|error notices' src/main/db.test.js src/main/dataset-catalog.test.js src/renderer/app.test.js` covers stale projections/FTS/summaries/source counts, preserved raw records and identity, indexes/planner statistics, repeated and empty rebuilds, rollback, active-ID/concurrency guards, confirmation cancellation, duplicate work, failure recovery, persistent failure notifications and refresh. A disposable worker fixture spans 501 ads to exercise multiple read batches and progress before completion. Never test `reprocess()` against the real dataset without intending a full write rebuild. Full-scale runtime and disk usage remain unverified.

2026-10-18: all 68 tests, changed-JS syntax/editor checks and disposable `npm start -- --no-sandbox` startup pass. Browser fixture verifies warning/Cancel focus and modal fit at 960x600, injected 43% progress at 960x600 and 1400x900 with content pushed down and no overflow, progress retained in Settings, and dismissible error surviving `done`. Native confirmation-to-rebuild interaction was not exercised. Renderer VM duplicate-work tests must await an explicit IPC-start promise; one microtask tick is not enough across contexts and can hang the test.

## Stale listing tags (D48)
`node --test --test-name-pattern='array.*tags|array tag repair' src/main/db.test.js` covers one-time repair of stale array-valued taxonomy/employment/hours, listing/filter/summary agreement, existing-value and raw-JSON preservation, empty arrays and rollback/retry across the 500-row batch boundary. Live DB inspection must use `new DatabaseSync(path, {readOnly: true})`; `ensureSummary()` is a write migration and must be tested on disposable copies/fixtures unless a real migration is intended. Full-scale migration and native post-repair listing remain unverified.

2026-10-18: all 62 tests pass (`node --test src/main/db.test.js src/main/dataset-catalog.test.js src/renderer/app.test.js`); DB implementation/test syntax and editor checks pass. Copied all 642 `Getdet AB` ads dated 2026 from the real DB into memory, preserving stale columns and raw JSON: 624 lacked field/occupation/employment before repair, zero afterward (46 ms on this small warm fixture, not a full-scale estimate). Every promoted tag matched the preserved existing value or current raw normalization; raw JSON, list size and summary totals stayed intact. Live database was opened read-only and not modified.

## Top-employer statistics (T9 / D43)
2026-10-31 D55: full suite passes 102 tests; syntax/editor checks pass. Focused command: `node --test --test-name-pattern='employer|organization identities' src/main/db.test.js src/renderer/app.test.js`. Covers precomputed mapping/catalog reads (no JSON extraction, label aggregation or writes during filtering), consolidated IDs, missing-ID and same-name/different-ID isolation, indexed plans, summary/removal/reprocess consistency, failed 501st-row migration retry, identity toggles/chips/focus/session retention. Reload fixtures must stub `localStorage.getItem()` as well as `removeItem()`; fixture-only repair was explicitly approved.

Disposable native recipe: seed two Kils spelling variants with organization ID `2120001751` into `<temporary XDG_CONFIG_HOME>/AMS Viewer/datasets/default.db`, create the dataset catalog and build summaries before launching Electron with `--no-sandbox --remote-debugging-port=0`. After `[startup] window shown`, use the main renderer's DevTools target and wait for `[data-employer-id="2120001751"]` via MutationObserver; click it and inspect the real bridge plus session filters. Verified one entry/count 2, `{id,label}` selection/chip and both result IDs, then `window.close()` gave normal exit 0 (574 ms startup). Live datasets untouched; physical native keyboard, full-scale backfill time/disk cost and query latency unverified. Canonical names remain dataset-wide under filtering and may change after the last source using a variant is removed.

2026-10-18 D47/UI-022: all suites pass 60 tests. Notice tests slice `/* ---------- notifications` to `const esc =` with a fake `document.createElement`; tests slicing `loadStats` must stub `reportStatsError`. Browser fixture: inject `window.api` with `tasks: async () => [...]` and `onTask: cb => (window.__task = cb)`, then call `window.__task({...})`. Safe native smoke start without touching the real DB: `T=$(mktemp -d); XDG_CONFIG_HOME=$T timeout 12s npx electron . --no-sandbox; rm -rf "$T"`.

2026-10-18 D46: `node --test src/main/db.test.js src/main/dataset-catalog.test.js src/renderer/app.test.js` passes 57 tests; `node --check src/main/db.js && node --check src/main/db.test.js` passes. New regressions require indexed employer predicate plans (count/date projections covered) and index creation on an already-built summary without rebuilding, followed by a no-op repeat. Read-only real-DB inspection confirmed summary version 2, missing employer index and `SCAN a`; no live data was modified. Disposable in-memory 130k-ad fixture (130 selected ads) measured search/count/timeline/facets before: 33.21/8.08/46.33/18.20 ms; after: 4.70/0.04/0.15/0.85 ms. All list rows, facet dimensions, Top-30 counts and timeline bins matched exactly. Timings are synthetic and sequential, not full-scale or cold-disk guarantees. Real migration duration and post-index native employer interaction remain unverified.

`node --test src/main/db.test.js src/renderer/app.test.js` covers active-filter counts, descending ranking, top-30 cap, summary updates on import/removal and safe rendering of employer names/count tooltips. An unfiltered raw group-by took 167,837 ms on 11.25M ads; `sum_employer` now serves that case. Summary-version-2 rebuild, filtered full-scale latency and visual layout remain unverified.

2026-10-18 D45/SRC-022: both suites pass 46 tests; `node --check src/main/db.js && node --check src/renderer/app.js` passes. Employer fixtures cover exact case/trailing-space names, SQL metacharacters, multiple selections, combined keyword/location/date/employment/hours, relevance, counts/timeline/statistics, toggles, chips, clearing, dataset reset and session restoration. Browser fixture verifies native Enter/Space toggles and chip removal, keyboard focus after statistics refresh, all four request filters, draft text, ad return and reload retention. Native Electron interaction and full-scale employer-filter latency remain unverified. Refresh DOM stubs need `querySelector()`; filter/widget fixtures must include `employers: []`.

The same fixture verified two restored employer selections and Clear all. Employer buttons are enabled native buttons with `tabIndex=0`; actual Tab traversal remains unverified because the hidden integrated browser did not deliver Tab `keydown` events (`document.visibilityState === 'hidden'`), even after `bringToFront()`. Enter/Space events worked.

## Dataset chooser, switching and deletion (T17 / D42)
`node --check src/main/main.js && node --check src/main/preload.js && node --check src/main/db.js && node --check src/renderer/app.js && node --test src/main/dataset-catalog.test.js src/main/db.test.js src/renderer/app.test.js` covers cached/backfilled chooser counts, one-line descriptions, creation entry, switch success/failure, filter reset, old-history rejection, deletion confirmation and last-dataset replacement. The stats query reads `sources` rows only. Native chooser rendering and switching across multiple full-scale DBs remain unverified.

## Named datasets (D39)
`node --test src/main/dataset-catalog.test.js src/main/db.test.js src/renderer/app.test.js` covers migration recovery/conflicts, catalog metadata/name validation, final-default behavior and isolation of identical ad IDs across DBs. `node --check src/main/main.js && node --check src/main/preload.js && node --check src/main/read-worker.js` checks dataset IPC and worker routing.

The first app startup after upgrade moves `~/.config/AMS Viewer/ads.db` and any `-wal`/`-shm` files into `~/.config/AMS Viewer/datasets/default.db`. Back up the data folder first. T15 was smoke-tested on the 11,252,350-ad DB. T17 IPC/render paths have automated coverage; native chooser interaction and multi-dataset full-scale latency remain untested.

## Dataset metadata editor (T16 / D40)
`node --test src/renderer/app.test.js` covers heading-click selection, new-editor focus/selection, name validation, multiline metadata saves, explicit Discard and dirty-exit Save/Discard/Cancel behavior. D41 additionally covers inline plain-text markup, input tracking, caret-preserving edit-mode clicks and Enter routing (including IME composition). Browser fixture confirmed identical display/edit fonts and colors, full heading selection, real keyboard multiline input/save and Discard restoration. Long names and unbroken descriptions fit at 960×600 and 1400×900 without overlap or horizontal overflow; inline-editor screenshot reviewed. T17 chooser integration and deletion are covered by renderer tests. Native app-close choices remain untested.

## Full-scale filtering and facet reuse (D37)
2026-10-17: `node --test src/main/db.test.js src/renderer/app.test.js` passed 31 tests. Query tests cover tied/null date ordering, offsets, sparse/absent matches, date ranges, own-dimension exclusion, missing keys, same-connection and cross-connection cache invalidation, eviction and failed-query recovery. Cross-connection tests use a disposable WAL database and exercise incremental summary updates and source removal.

Read-only probes used `new DatabaseSync(path, {readOnly: true})`, not `dbm.open()` (which applies schema/PRAGMAs). On the real 11,252,350-ad DB, Stockholm (`loc: [{k: 'region', id: 'Stockholms län'}]`) list improved from 66,550 ms to 5 ms; adding healthcare (`sel: [{k: 'field', id: 'NYW6_mP6_vwf'}]`) improved from 3,952 ms to 31 ms. Repeat lists took 1-2 ms. Leading IDs matched. Region facets measured 13,322 ms before batching and 6,939 ms after; the following combined query measured 37,266 ms before and 6,274 ms after (both after warming region-only dimensions). Repeat facets took 12-13 ms. Every combined-filter facet count matched independent SQL grouping the original ads with its own dimension excluded. No OS cache clearing; measurements were sequential, not cold-cache guarantees or a parallel rapid-interaction benchmark.

`timeout 12s env AMS_TRACE=1 npm start -- --no-sandbox` opened the window in 598 ms, facets in 19 ms end-to-end; `[query]` showed queue/work separately. Only known Wayland/Vulkan warning and expected SIGTERM. Native combine/uncombine interaction was not exercised. Counts/timelines and uncancelled obsolete SQL remain outside this optimization. The inspected real DB had no `sqlite_stat*` tables; no real-data migration, ANALYZE or index changes were performed.

## Statistics sidebar width (D36)
All 23 renderer tests and syntax checks passed (2026-10-16). Width tests cover left-divider direction, pointer identity/cancellation/cleanup, keyboard bounds, saved-width restoration after viewport clamping and invalid/unavailable storage. Browser fixture verified real 280-to-400 px dragging, keyboard resizing to 420 px, collapse/reload retention and Home/End. With a saved 720 px width, reloading at 960x600 clamps statistics to 467 px beside the collapsed menu, hides filters and leaves 420 px for results; widening to 1400x900 restores 720 px. Passed in both fonts. Width storage is `statisticsW`, independent of `filterW` and widget heights. Native Electron width interaction and quit/relaunch retention remain untested.

## Statistics widgets and responsive columns (D35)
`node --test src/renderer/app.test.js && node --check src/renderer/app.js` passed all 21 tests (2026-10-16). Shared widget fixtures now include `geography` and `employers`; column tests cover independent persistence, accessible state, unavailable storage, responsive priority and expanded-menu/large-filter constraints. Browser fixture passed both statistics pointer drags, keyboard resizing/title collapse, column toggles and reload retention. Layout checks passed at 960x600 and 1400x900 in both fonts, including explicitly opening statistics at minimum size and restoring filters without losing either preference. Dragging filters to 720 px, reloading at 960 px and widening restored 720 px. Statistics screenshot reviewed; native Electron interaction/resize and quit/relaunch not tested. `timeout 12s npm start -- --no-sandbox` showed 11.25M ads in 578 ms, with the known Wayland/Vulkan warning and expected SIGTERM only.

The hidden integrated-browser tab may not emit viewport resize events or advance animation frames: after `page.setViewportSize`, explicitly dispatch `window.dispatchEvent(new Event('resize'))` through `page.evaluate` before checking responsive layout. Locator clicks can stall waiting for stability; focus plus native Enter/Space or Playwright mouse coordinates works. Wide emulated screenshots may be clipped to the browser panel's actual visible area; bring the target within that area for visual review.

## Vertical widget resizing (D34)
`node --test src/renderer/app.test.js && node --check src/renderer/app.js` passed all 18 tests (2026-10-16). Resize tests cover all six widgets, independent saved heights, pointer identity/cancellation/cleanup, keyboard bounds, collapse retention, viewport clamping/restoration and invalid/unavailable storage. Browser fixture passed six real pointer drags, reload/Collapse/Clear all retention, Home/End/Up, scrollable trees beyond 240 px, and non-overlap/no horizontal overflow at 960x600 and 1400x900 in both fonts. Minimum-window screenshot reviewed; native Electron interaction and quit/relaunch not tested.

Populated facet fixtures need `year`, not `years`; a wrong key throws after trees render, leaving year/employment/hours chips empty. Timeline points use `{d: '2026-01-01', n: 10}` with `unit`, `from` and `to`. If integrated-browser `scrollIntoViewIfNeeded()` stalls waiting for stability, DOM `scrollIntoView({block: 'center', behavior: 'instant'})` followed by real Playwright mouse dragging works.

## Application messages and source-removal confirmation (D33)
`node --test src/renderer/app.test.js && node --check src/renderer/app.js` passed all 16 renderer tests (2026-10-16). Covers Cancel/explicit Escape/native cancellation, safe initial focus, focus restoration, plain-text filenames/messages, one removal per confirmation, and returned/rejected errors. Browser fixture passed focus containment/restoration, blocked Backspace/slash/question-mark navigation, Cancel/Escape without removal, Confirm once, and error OK/Enter dismissal. Modal fits at 960x600 and 1400x900; minimum-size screenshot reviewed. Real Electron deletion was deliberately not tested; browser `removeSource` was stubbed.

Explicit Escape key handling matches shortcut help; native dialog cancellation alone did not fire in the integrated-browser fixture. `.btn` sets `display: inline-flex` and primary buttons span full width: modal actions use `.btn.sec` and explicitly honor `[hidden]`. Browser timeline fixtures must return `{points: [], unit: 'year'}`, not an array.

## Hierarchical filter collapse all (D30)
`node --test src/renderer/app.test.js && node --check src/renderer/app.js` passed all 12 renderer tests (2026-10-16). Collapse coverage checks both trees independently, hidden descendant expansion keys, search clearing, unchanged selections, persistence writes and repeated activation. Browser fixture passed DOM click, native Enter/Space activation and reload persistence. Revised 12px text controls were verified directly below search fields at 960x600: no overlap/clipped text, collapse works, and controls hide with their widget bodies. Native Electron interaction was not manually tested. Tree search auto-expands matching branches, so collapse must clear only the target tree's search text. Existing fixtures that mock `querySelectorAll` must distinguish `[data-collapse-tree]` from facet-count selectors.

Final D30 styling refinement: collapse-all controls use 11px text, a 1px border and 4px corners. Browser measurements at 960x600 confirmed 20px button height versus 26px filter chips (2026-10-16), retaining the below-search placement.

## Find in ad (D28)
`node --test src/renderer/app.test.js && node --check src/renderer/app.js` covers case-insensitive match ranges and renderer regressions. In a browser fixture, load an ad with repeated text, search it, then verify all marks, next/previous cycling, `0/0` with disabled controls for no matches, and clearing. With the list hidden and a representative breadcrumb, find controls align to the right padding without overlap; the input is 165px at 960x600 and 190px at 1400x900. Real Electron interaction was not tested.

D29 shortcut checks (2026-10-16): all 11 renderer tests passed, including `/` routing from all four views and non-interception in inputs, textareas, selects and contenteditable elements. Browser keyboard fixture passed ad-find focus with unchanged history, typing/highlighting, literal slash in the find input, and Settings-to-list search fallback. Fixture ads use `window.api.get`, not `getAd`. Real Electron shortcut interaction was not manually tested.

## Contextual shortcut help (D31)
`node --test src/renderer/app.test.js && node --check src/renderer/app.js` passed all 14 renderer tests (2026-10-16). Browser fixture at 960x600 verified `?` routing and contextual content in Search, Ad, Datasets and Settings; editable-field typing; repeated activation; Escape and close-button dismissal; focus containment/restoration; and blocked background navigation. The dialog fit without scrolling in monospace and proportional modes. Real Electron interaction was not manually tested.

## Collapsible widgets and minimum-width filters (D27)
`node --test src/renderer/app.test.js` now includes independent collapse persistence, invalid/unavailable storage, active-selection badges, filter retention and badge clearing (nine renderer tests total, passed 2026-10-16).

Browser fixture: inject `window.api` before loading the renderer, with 30 occupation fields, 25 regions, 21 years, employment/hours options and a yearly timeline. At 310 px filter width, verify adjacent section rectangles do not overlap, each tree search starts below its heading, and filter `scrollWidth <= clientWidth`. Passed at 960x600 and 1400x900 in both font modes; screenshots reviewed. Reintroducing default section shrinking and `min-height: 0` reproduced zero-height tree sections with inputs outside their bounds.

Click/Enter/Space toggles, active-date badge, retained date input, independent chart/date/tree collapse after reload, and chart redraw after expand/drag resize passed. When expanding all widgets in Playwright, repeatedly click `.widget-toggle[aria-expanded="false"]` with `.first()`; locators returned by `.all()` use shifting indexes as the selector stops matching expanded buttons. Real `timeout 12s npm start -- --no-sandbox` opened 11.25M ads in ~0.6 s; known Wayland/Vulkan warning and expected SIGTERM only. Actual Electron quit/relaunch persistence and non-year chart label layouts were not manually tested.

## Settings and typography (D26)
`node --test src/renderer/app.test.js` covers default-on typography, boolean validation, malformed/unavailable storage, immediate changes, persistence across renderer restart and Settings navigation preserving list scroll. Seven renderer tests passed 2026-10-16.

Browser checks with a fixture `window.api` verified checkbox and Space activation, proportional/monospace switching, reload persistence, ad-body inheritance, Backspace/forward history and Settings/search fit at 960x600 and 1400x900. Settings screenshot reviewed at minimum window size. Fixture checks do not exercise real IPC or Electron quit/relaunch. `timeout 12s npm start -- --no-sandbox` separately opened the real 11.25M-ad app in ~4.6 s; only environmental Wayland/GPU warnings, expected SIGTERM on timeout.

## Facet and compact-count regressions (D25)
2026-10-16 follow-up (SRC-009): all 25 renderer tests and the renderer syntax check passed. Added coverage for pending-to-complete refresh, superseded responses and rejected-request diagnostics. A fresh native Electron window populated startup counts and refreshed `neuropsykolog` to 9,100 ads; the user confirmed numbers in that window. The reported original-window startup stall was not reproduced or diagnosed; no root-cause fix is claimed.

```bash
node --test src/main/db.test.js src/renderer/app.test.js
```
Uses in-memory SQLite and renderer helper evaluation (no real DB writes). Covers missing-value normalization, all five facet dimensions and own-filter exclusion, locations present in results, duplicate tree leaves, compact unit boundaries, exact tooltips and pending-count invalidation. Five tests passed 2026-10-16. A read-only query on the real 11,252,350-ad DB for `neuropsykolog` returned 9,100 ads and identical totals in all five facets (~846 ms combined); no visible location had a zero facet count. Electron startup smoke test (`timeout 15s npm start -- --no-sandbox`) showed the window in ~625 ms; no app errors, only an environmental Wayland/Vulkan warning. Timeout termination is expected. Visual fit and interactive rapid-filter changes were not manually reviewed.

## Syntax / startup
```bash
node --check src/renderer/app.js && node --check src/main/db.js && node --check src/main/main.js
timeout 10 npx electron . --enable-logging 2>&1 | grep -iE "uncaught|console|error" | grep -viE "dbus|gpu|vulkan|ozone"
```
No output means no startup or renderer console errors.

## Query checks against the real DB
```bash
node --no-warnings -e "
const d=require('./src/main/db');
const db=d.open(process.env.HOME+'/.config/AMS Viewer/datasets/default.db');
const c=f=>d.search(db,f,0,1,true).total;
console.log(c({}), c({terms:['sjuksköterska','hemtjänst']}));
console.log(Object.keys(d.facets(db,{})));"
```
Filter shapes are listed in `docs/data-model.md`. Reference numbers for `2026-Q3.jsonl`: 129,721 ads; `sjuksköterska` 8,675; `hemtjänst` 2,594; both 674. Timings: list a few ms, facets cold ~300 ms, filtered ~60 ms.

## Headless import (same code as the app)
```js
// /tmp/runimp.js
const {Worker}=require('worker_threads');
const w=new Worker('src/main/import-worker.js',{workerData:{dbPath:process.env.HOME+'/.config/AMS Viewer/datasets/default.db',files:['2026-Q3.jsonl']}});
w.on('message',m=>m.type!=='progress'&&console.log(JSON.stringify(m)));
```
Run from the project root with `node --no-warnings /tmp/runimp.js`. Use a different `dbPath` (e.g. `/tmp/test.db`) to avoid touching the real database.

## Build
```bash
npm run pack && timeout 8 dist/linux-unpacked/ams-viewer --no-sandbox
```

## Python
If a script ever needs Python, create a `uv` virtual environment; never use system Python.

## Large JSON-array import test
Build array files from the stored ads (no source file needed) and import them into a scratch DB:
```js
// mk.js: node --no-warnings mk.js 100000 ~/.cache/ams-test/big.json   (single-line array, ~500 MB)
const d=require('/path/to/src/main/db'),fs=require('fs');
const db=d.open(process.env.HOME+'/.config/AMS Viewer/datasets/default.db');
const [limit,out]=[+process.argv[2],process.argv[3]];const fd=fs.openSync(out,'w');fs.writeSync(fd,'[');let n=0;
for(const r of db.prepare('SELECT raw FROM ads LIMIT ?').iterate(limit)) fs.writeSync(fd,(n++?',':'')+r.raw);
fs.writeSync(fd,']');
```
Import with the headless worker runner (set `dbPath` to a scratch file under `~/.cache/`, not `/tmp`, which may be RAM-backed) and print `process.resourceUsage().maxRSS` at exit. Reference: 511 MB / 100k ads in 29 s, max RSS 146 MB. Delete the scratch files afterwards.

## Summary-table consistency (D23)
On a scratch DB under `~/.cache/`: `open` + `ensureSummary` on the empty DB (so the incremental path is used), import two sample files (`head -n 20000` of real files) with the headless Worker runner, `removeSource` one, snapshot all `sum_*` tables, delete `meta.summary_version`, `ensureSummary` again, compare snapshots (must be equal). Verified 2026-10-16. Write the script to a file, not inline (`!` history expansion).
