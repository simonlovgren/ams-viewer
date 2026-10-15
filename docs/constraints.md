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
- Facet cost scales with matching rows. At 130k rows it takes ~280 ms; at multi-million rows expect seconds unless a summary table or caching is added.
- List paging uses `LIMIT/OFFSET`; deep scrolling in very large result sets becomes slower (keyset paging would be the fix).
- No auto-update, code signing or custom app icon. Packaging uses electron-builder (`npm run dist`); only the Linux unpacked build has been tried.
- Linux tested only. Mouse back/forward buttons are handled via DOM `mouseup` buttons 3 and 4; behaviour may differ on other platforms.
- Electron may require `--no-sandbox` on systems where the `chrome-sandbox` helper is not set up.

## Scope constraints
- Read-only browsing: no editing, bookmarking, export or statistics views.
- No automatic update of existing ads from newer files.
- Data is local only; the single network use is employer logo images and links opened externally.
- UI language is English only; dates are formatted `en-GB`.
- Not verified visually in the original build session; layout issues should be expected in small windows (minimum 960×600 is enforced).
