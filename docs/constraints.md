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
- A single writer: only one import runs at a time. Removing a source is blocked during import, and runs on the main thread, so large removals may briefly freeze the UI.
- Search and ad lookup run on the main thread; they are fast (ms) but a pathological query could delay IPC. Facet counting is offloaded.
- The ads-over-time chart adds one grouped query per update; with an active date filter the combined facets+chart update took ~0.8 s at 130k ads (warm cache).
- Facet cost scales with matching rows. At 130k rows it takes ~280 ms; at multi-million rows expect seconds unless a summary table or caching is added.
- List paging uses `LIMIT/OFFSET`; deep scrolling in very large result sets becomes slower (keyset paging would be the fix).
- No auto-update, code signing or custom app icon. Packaging uses electron-builder (`npm run dist`); only the Linux unpacked build has been tried.
- Linux tested only. Mouse back/forward buttons are handled via DOM `mouseup` buttons 3 and 4; behaviour may differ on other platforms.
- Electron may require `--no-sandbox` on systems where the `chrome-sandbox` helper is not set up.
- Resized filter/statistics widget bodies are limited to 80 px through max(80 px, window height minus 160 px); excess content scrolls. Unsized filter widgets retain natural heights; unsized trees retain their 240 px cap. Statistics bodies start at 200 px (D34, D35).
- Statistics width ranges from 280 px to the minimum of 720 px, 60% of viewport width and remaining menu/results space. Below 1200 px it starts hidden; manually opening either column or resizing statistics can temporarily hide the other to leave at least 420 px for results at supported window sizes. Both sidebar widths are clamped while space is limited without overwriting their saved preferences (D35, D36).

## Scope constraints
- Read-only browsing: no editing, bookmarking or export. The statistics column is present, but geographic and employer statistics remain unavailable until T5/T9 (SRC-019/SRC-020).
- No automatic update of existing ads from newer files.
- Data is local only; the single network use is employer logo images and links opened externally.
- UI language is English only; dates are formatted `en-GB`.
- Not verified visually in the original build session; layout issues should be expected in small windows (minimum 960×600 is enforced).

## Full dataset (2006–2026), measured 2026-10-15
- Source is ~57 GB (21 files); the database is about 1.2x the source size (3.6 GB array became a 4.4 GB database), so expect roughly 70 GB under the `userData` folder and an import time of about an hour (about 20 MB/s).
- Ads from 2006–2017 have no occupation, location or employment type; occupation and location filters only cover 2018 onwards.
- Ads with several occupations (2023+) are filterable only by their first occupation (D20).
- Facet options, the unfiltered total, date-only counts and the chart come from summary tables (D23, NFR-010). The first start on an existing large database builds them once in the background (minutes on 11M ads); until then the UI shows a progress message, and import and source removal are refused. Filtered facets and counts still group the matching rows, so a broad filter (for example a one-letter prefix) can be slow; a running obsolete query is not cancelled.
