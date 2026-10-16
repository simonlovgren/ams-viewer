# Data requirements (DAT)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| DAT-001 | The application shall use historical job ad data in JobTech JSONL format (one ad per line) as its source. | Must | Implemented | Reference file: `2026-Q3.jsonl`. |
| DAT-002 | It shall be easy to add more source files; files for 2006–2026 are expected over time. | Must | Implemented | Via Data sources view. |
| DAT-003 | The application shall import data into an embedded local database rather than use the files as-is. | Must | Implemented | SQLite, `~/.config/AMS Viewer/ads.db`. |
| DAT-004 | The import feature shall accept multiple files in one operation. | Must | Implemented | File picker multi-select and drag & drop. |
| DAT-005 | The importer shall accept `.jsonl`, `.ndjson` and `.json` (array) files of any size. | Should | Implemented | Array files are streamed (511 MB single-line array: 100k ads in 29 s, peak RSS 146 MB). |
| DAT-006 | Import shall not block the UI and shall show progress (file x of n, added, duplicates, errors). | Must | Implemented | Worker thread. |
| DAT-007 | Ads already stored (same ad id) shall be skipped on import, so files may be re-imported or overlap. | Must | Implemented | |
| DAT-008 | Invalid records shall be counted and skipped without aborting the import. | Must | Implemented | Lines are split on `\n` only; U+2028/2029 occur inside texts. |
| DAT-009 | The user shall be able to see imported sources with ad counts and remove a source with its ads. | Should | Implemented | |
| DAT-010 | The application shall show total ad count, number of sources and year range covered. | Could | Implemented | |
| DAT-011 | If the database is empty at startup, the application shall open the Data sources view. | Could | Implemented | |
| DAT-012 | The importer shall handle all generations of the source data (2006–2026): ads without an id, numeric ids, array-valued taxonomy fields, `.jsonl` and `.json` array files, and both date formats. | Must | Implemented | Verified on samples of every file and full imports of `2018.json` (3.6 GB array, 683k ads, 188 s, peak RSS 210 MB) and `2006.jsonl` (243k ads, 34 s). Remaining files not fully imported yet. |
| DAT-013 | The Data sources page shall update the imported-files list while an import runs and when it finishes, without reloading the view. | Should | Planned | Not started. Today the list is re-rendered only on completion and only if the view is open. See docs/tasks.md. |
| DAT-014 | For each imported file the Data sources list shall show the elapsed import time, the number of duplicates and the number of errors. | Should | Planned | Not started. Needs these values stored per source. See docs/tasks.md. |
| DAT-015 | The application shall enrich missing occupation information in older ads by cross-referencing `legacy_taxonomy_id` with the newest available dataset containing a reliable mapping, so resolved information is displayed and filterable like that of newer ads. | Should | Planned | T12. Survey other legacy taxonomy fields for the same approach. Preserve existing values; leave ambiguous or unmatched values unresolved. |
| DAT-016 | The application shall enrich missing location information in older ads by cross-referencing available `workplace_address` fields with the newest available dataset containing a reliable geographic mapping, so resolved information is displayed and filterable like that of newer ads. | Should | Planned | T12. Verify field coverage and historical geographic changes; preserve existing values and leave ambiguous or unmatched values unresolved. |
