# Tasks (what is in the pipe)

Planned work that is specified but not started. Each task links to its requirements; when work starts, set the requirement to `In progress`, record decisions in [design-decisions.md](design-decisions.md) and remove or tick the task here. Last updated 2026-10-15.

| # | Task | Requirements | Size |
|---|---|---|---|
| T6 | Full-scale performance of filtering, counts and statistics (lower priority since startup is fixed; [plan](full-scale-performance-plan.md)) | NFR-003, NFR-004, NFR-005 | L |
| T1 | Resizable hierarchical filter boxes | UI-010 | S |
| T2 | Collapsible filter widgets and graphs | UI-011 | S |
| T3 | Live-updating import file list | DAT-013 | S |
| T4 | Import statistics per file (time, duplicates, errors) | DAT-014 | M |
| T5 | Geographical hotspot view | SRC-019 | L |
| T7 | Monospace "data inspection" typography | UI-012 | S |
| T8 | Statistics bar on the right (collapsible, hosts the graphs) | UI-013, UI-011, SRC-017 | M |
| T9 | Top-30 employers widget | SRC-020 | M |
| T10 | Employer logo cache | AD-010 | M |

Priority order: T7 early (pure CSS, affects how everything else is judged), T8 before T2 (so one collapsible-widget mechanism serves both bars), then T2 and T1 together, T3 with T4 (same view), then T9 and T5 (both live in the statistics bar); T10 is independent and can slot in anywhere. T6 follows the [full-scale performance plan](full-scale-performance-plan.md) when filtered use at full scale feels slow, and before T9 and T5 if their queries make it worse.

## T1. Resizable hierarchical filter boxes (UI-010)
- The occupation and location trees currently have a fixed `max-height: 240px` (`.tree` in `styles.css`).
- Add a vertical drag handle at the bottom of each tree box (or CSS `resize: vertical` on the container) and persist the heights in `localStorage` like the sidebar width (`D17`).
- Decide: min height (about 80 px), max height (container or window based), and whether heights reset on "Clear all" (suggest: no).
- Docs: UI requirement status, a line in D17 (or a new decision if the approach differs), developer notes (unverified visual layout).

## T2. Collapsible widgets (UI-011)
- Widgets: Published, Occupation, Location, Employment, Working hours in the filter sidebar; ads-over-time chart, employers (T9) and the map (T5) in the statistics bar (T8). Build one reusable collapsible-widget helper for both bars.
- Clicking a section title (`h4` in `.f-sec`) toggles it; show a chevron icon; keep the title keyboard accessible (button or `tabindex` + Enter).
- Persist collapsed state per widget in `localStorage`.
- Interaction with T1: a collapsed tree keeps its saved height; the chart keeps rendering in the background or re-renders on expand (it already uses a `ResizeObserver`).
- Decide: whether collapsed widgets that hold an active filter show a small badge or count so the user does not forget a hidden filter (suggest: yes).

## T3. Live-updating import file list (DAT-013)
- Today `renderData()` runs on the data view and after import completion; per-file completion (`file-done`) is ignored, so the list changes only at the very end.
- On each `file-done` event, refresh the sources table (and totals) without re-rendering the whole view or the progress panel; also when a file is removed.
- Consider also updating the row of the file currently importing (ads added so far) from progress events.
- Watch out: the code that restores `importState` after `renderData()` is a workaround; a targeted table update removes the need for it.

## T4. Import statistics per file (DAT-014)
- Show per file: elapsed time, duplicates (skipped), errors (and added count).
- The worker already counts `inserted`, `skipped` and `errors` and emits them in `file-done`; elapsed time must be measured in the worker.
- Schema change: add columns to `sources` (`duration_ms`, `skipped`, `errors`, maybe `size_bytes`) with an `ALTER TABLE` migration at open time (existing rows stay null and show as "n/a"); record a decision (new D with DAT-014).
- Re-importing a file overwrites its row; decide whether to keep a history (suggest: no, latest run only).
- Also useful: show the same figures live for the running import.

## T5. Geographical hotspot view (SRC-019)
- Goal: below the timeline, a map-like view of where the filtered ads are, as a hotspot/heat overlay, following all active filters like the chart.
- Data: `workplace_address.coordinates` exists in newer ads (2026 sample has `[lon, lat]`); older eras mostly have only municipality/region (and none before 2018). Needs a survey of coordinate coverage per file first.
- Open questions to settle with the user before building:
  - Base map without network (requirement NFR-002: offline): bundle a simplified Sweden outline (GeoJSON, e.g. from public domain/open data, with licence noted) and draw it in SVG, versus loading online map tiles (violates offline, adds a network dependency and a CSP change).
  - Fallback location for ads without coordinates: municipality centroid (needs a municipality-to-coordinate table) so older ads still show.
  - Aggregation: grid or municipality bins computed in the facets worker (new query like `timeline()`), to avoid shipping millions of points.
  - Interaction: hover shows count; optional click to filter by municipality/region (would tie into SRC-014 location selections).
- Storage: promote `lat`/`lon` (or a grid cell id) to columns, which is a schema change and needs a re-import or a backfill from `raw`; record a decision and update `data-model.md`.
- Performance budget: must stay within NFR-003/NFR-005; measure on the full data set.

## T6. Full-scale performance of filtering, counts and statistics (NFR-003, NFR-004, NFR-005)
- Update 2026-10-16: facet options, total, date-only counts and the chart now use summary tables (D23, NFR-010); remaining: filtered group-by cost on broad filters, deep OFFSET paging, cold-cache queries.
- Status 2026-10-15: the startup and freeze problems at about 70 GB / 11 million ads are fixed (D22: reads in workers, splash, window shown in about 3 s). Priority lowered by the user. What remains is slow filtered counts, facet counts, timeline and cold queries; main process and list stay responsive meanwhile.
- Follow the [full-scale performance plan](full-scale-performance-plan.md) (sections 1 and 2 are largely done by D22): measure first, optimize facets/counts/timeline, benchmark compact metadata storage, bound obsolete work and replace deep OFFSET paging.
- Retain Electron + SQLite initially. Consider Rust or another engine only if profiling demonstrates a remaining bottleneck that warrants the change.
- Existing measurements at 926k ads are not a full-scale baseline; remeasure startup, list, keyword, exact counts, facets, timeline and detail lookup on the full dataset.

## T7. Monospace typography (UI-012)
- Today the UI uses a sans-serif stack (`Inter`, `Segoe UI`, `system-ui`) set on `body` in `styles.css`; there are no bundled fonts and the CSP allows only `font-src 'self'`.
- Fonts must work offline: use a system monospace stack (for example `"JetBrains Mono", "Fira Code", "DejaVu Sans Mono", ui-monospace, monospace`) or bundle a font file in `src/renderer/` (licence noted, plus a decision for the new asset).
- Decide scope with the user: everything, or only data-like text (dates, counts, ids, tags, chart labels, filter tree, data-source table) while ad body text and headings stay proportional for readability. Ad descriptions in monospace may hurt reading long texts.
- Implement through a CSS variable (`--font-mono`, optionally `--font-ui`) so the choice is one switch; check the tag, date box, chart (SVG text) and tree widths, since monospace is wider and may need size or padding tweaks.
- Optional: a setting to toggle monospace on/off (would need its own requirement).
- Docs: UI requirement status, a decision (typography and font source), developer notes (unverified visual result).

## T8. Statistics bar (UI-013)
- New right-hand column in the search view (`#view-list`), next to `#results`; collapsible with a toggle like the filter bar (`UI-008`, `D17`) and with a remembered state; a resizable width is optional.
- Move the ads-over-time chart (`#chart`, `renderChart()`, currently the first section of `#filters`) into it; its `ResizeObserver` already follows the container width. SRC-017 stays `In progress` until this is done.
- Each statistics widget is a titled section that collapses on title click (shares the helper from T2).
- Layout: the list needs a sensible minimum width, so decide what happens on narrow windows (suggest: auto-collapse the statistics bar below about 1200 px).
- Data: the chart and statistics already come with the facets result; keep sending them in one worker call, or split them off if T6 shows they slow filtering.
- Docs: new decision (layout), `system-description.md` (UI structure), developer notes.

## T9. Top-30 employers widget (SRC-020)
- Query: group the filtered ads by employer name (`ads.employer`) and return the 30 most frequent, as part of the facets worker (`facets()` in `db.js`, like `timeline()`), following all active filters.
- Index: `employer` has no index; at full scale a grouped scan over millions of rows is slow, so add an index or fold it into the summary-table work (T6); measure before deciding.
- Display: labels (chip style) with the ad count, ordered by count descending; full name in a tooltip; collapsible like the other widgets.
- Open questions: names differ in spelling and case (could group on `employer.organization_number` when present, which exists from 2018); whether clicking a label should filter by that employer (needs a new filter dimension, see "Adding a new filter dimension" in `data-model.md`, and its own requirement).
- Docs: decision if grouping by organisation number or adding an index or filter; `data-model.md` if the schema changes.

## T10. Employer logo cache (AD-010)
- Today the ad view loads `logo_url` directly in an `<img>` (CSP `img-src` allows any `https:`); nothing is stored, so every view hits the remote host and fails offline.
- Cache on first view only; the importer must not fetch logos. Store files under the data folder next to `ads.db` (for example `<userData>/logo-cache/`), one file per logo, named by a hash of the URL (never use the URL or ad text as a file name).
- Flow: the renderer asks main (`api` call) for the logo; main returns a local file on a cache hit, otherwise downloads it, stores it, and returns it. Serving the file needs a safe route: a `data:` URL for small images (CSP already allows `data:`), or a registered custom protocol for the cache folder (would need a CSP change and a decision).
- Download in the main process with limits: `https` only, redirect cap, timeout, maximum size (for example 1 MB), accept only image content types, and verify the response is a real image. This replaces the browser's `no-referrer` load, so send no cookies or referrer.
- Failures: remember failed URLs (negative cache entry with an expiry, for example a day) so dead links are not retried on every view; fall back to the initial-letter box as today.
- Many ads share one employer logo URL, so the cache is small compared to the database; still decide whether to bound its size (suggest: no limit at first, show size on the Data sources page, offer "clear cache").
- Privacy and offline: first view of each logo contacts the host once; afterwards it works offline. Mention this in the README/constraints.
- Decisions to record: where files live and how they are served, security limits, negative caching. Update `system-description.md` (new data flow) and `constraints.md`.

## Other open items (not requirements yet)
- Re-import `2016.jsonl` (shows 0 ads) and import the remaining files.
- Visual review of the recently added UI (chart, AND/OR button, resizable sidebar, zero-count styling, search chips).
- Ideas listed in [developer-notes/project-state.md](developer-notes/project-state.md).
