# Constraints and limitations

## Data constraints
- Source: JobTech historical job ads, JSONL, one JSON object per line, ~770 MB / ~130k ads per quarter file (2026-Q3 as reference). Files exist for 2006–2026.
- Ad texts are mostly Swedish; the UI is English. Search uses Unicode tokenisation with diacritics folded, but no stemming or language-specific handling (`sjuksköterska` will not match `sjuksköterskor` except via prefix matching).
- Fields may be null or missing in older ads; the importer tolerates this. Occupation/location values with no concept id fall back to the label as id, or are shown as "Unspecified" and are not selectable.
- Records without an `id` are counted as errors and skipped. A record's identity is its `id`; duplicates are ignored.
- The sample's `text_formatted` was always empty, so only `description.text` is used.
- Taxonomy labels differ across years; ads are grouped by `concept_id`, so old and new labels for the same concept merge (the `MAX(label)` is shown).

## Technical constraints
- `node:sqlite` is required (Node ≥ 22.5 / Electron ≥ 38) with FTS5 and `contentless_delete` (SQLite ≥ 3.43).
- Database size is roughly 1.3× the source data; 20 years of data will need tens of GB of disk.
- A single writer: only one import runs at a time. Removing a source is blocked during import and runs in the build worker.
- Each dataset has a separate SQLite DB under `<userData>/datasets/`; catalog is `<userData>/datasets.json`. First upgrade moves `ads.db` and WAL/SHM sidecars into the `default` dataset. Back up the data folder before upgrading. Dataset switching/deletion is blocked during import or summary builds; read-worker lanes drain before path changes.
- Dataset chooser counts are cached in the catalog and refreshed after startup, switching, import and source removal. Older catalogs backfill missing counts in read workers from source metadata; dataset operations are briefly blocked during that one-time refresh. If a database cannot be opened, its chooser entry reports statistics unavailable while remaining selectable.
- All database reads run in workers. Separate lanes avoid direct cross-request queueing, but concurrent queries can still compete for disk and page cache. An obsolete active query is not interrupted.
- The ads-over-time chart adds one grouped query per update; with an active date filter the combined facets+chart update took ~0.8 s at 130k ads (warm cache).
- Facet cost scales with matching rows. D37 batches equivalent predicates and caches up to 32 dimension/predicate groupings per connection; database writes invalidate the cache. Materialized facet keys may spill to temporary storage. On 11.25M ads, first-use broad region/field facets still took 6-7 s, while cached returns took 12-13 ms (2026-10-17).
- Top-employer statistics group exact `ads.employer` text. Unfiltered results use `sum_employer`; filtered results group matching ads in the facets worker. The unfiltered raw group-by took 167,837 ms on 11.25M ads. Summary version 2 rebuilds once in the background on next startup; no source re-import is needed. Filtered full-scale latency remains unmeasured (D43/D44, T6).
- Employer toggles match exact stored names, with no case/spelling merging. Top-30 statistics include employer selections rather than exposing alternative employers as own-filter-excluded facets; selected names absent from the output remain removable via active chips. No employer index was added; full-scale employer-filter latency is unmeasured (D45/SRC-022).
- List paging uses `LIMIT/OFFSET`; deep scrolling in very large result sets becomes slower (keyset paging would be the fix).
- No auto-update, code signing or custom app icon. Packaging uses electron-builder (`npm run dist`); only the Linux unpacked build has been tried.
- Linux tested only. Mouse back/forward buttons are handled via DOM `mouseup` buttons 3 and 4; behaviour may differ on other platforms.
- Electron may require `--no-sandbox` on systems where the `chrome-sandbox` helper is not set up.
- Resized filter/statistics widget bodies are limited to 80 px through max(80 px, window height minus 160 px); excess content scrolls. Unsized filter widgets retain natural heights; unsized trees retain their 240 px cap. Statistics bodies start at 200 px (D34, D35).
- Statistics width ranges from 280 px to the minimum of 720 px, 60% of viewport width and remaining menu/results space. Below 1200 px it starts hidden; manually opening either column or resizing statistics can temporarily hide the other to leave at least 420 px for results at supported window sizes. Both sidebar widths are clamped while space is limited without overwriting their saved preferences (D35, D36).

## Scope constraints
- Read-only ad browsing: no ad editing, bookmarking or export. Dataset metadata is editable; switching clears session filters and prior-dataset history, while failed switches preserve current state (D42). Top-employer statistics are implemented (SRC-020); the geographic view remains planned (SRC-019/T5) and has no placeholder widget.
- No automatic update of existing ads from newer files.
- Data is local only; the single network use is employer logo images and links opened externally.
- UI language is English only; dates are formatted `en-GB`.
- Not verified visually in the original build session; layout issues should be expected in small windows (minimum 960×600 is enforced).

## Full dataset (2006–2026), measured 2026-10-15
- Source is ~57 GB (21 files); the database is about 1.2x the source size (3.6 GB array became a 4.4 GB database), so expect roughly 70 GB under the `userData` folder and an import time of about an hour (about 20 MB/s).
- Ads from 2006–2017 have no occupation, location or employment type; occupation and location filters only cover 2018 onwards.
- Ads with several occupations (2023+) are filterable only by their first occupation (D20).
- Facet options, the unfiltered total, date-only counts, top employers and the chart come from summary tables (D23/D44, NFR-010). The first start on an existing large database builds them once in the background (minutes on 11M ads); until then the UI shows a progress message, and import and source removal are refused. Filtered facets, employer groups and counts still query matching rows, so broad filters can be slow despite D37 reuse; a running obsolete query is not cancelled. Sparse chronological filters can exhaust the bounded date probe and fall back to the expensive original plan; keyword/relevance and deep paging are not optimized by that probe. `[query]` logs separate queue and worker time; `[perf]` remains end-to-end and can include waiting or superseded requests.
