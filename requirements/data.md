# Data requirements (DAT)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| DAT-001 | The application shall use historical job ad data in JobTech JSONL format (one ad per line) as its source. | Must | Implemented | Reference file: `2026-Q3.jsonl`. |
| DAT-002 | It shall be easy to add more source files; files for 2006–2026 are expected over time. | Must | Implemented | Via Data sources view. |
| DAT-003 | The application shall import data into an embedded local database rather than use the files as-is. | Must | Implemented | SQLite, `~/.config/ams-viewer/ads.db`. |
| DAT-004 | The import feature shall accept multiple files in one operation. | Must | Implemented | File picker multi-select and drag & drop. |
| DAT-005 | The importer shall accept `.jsonl`, `.ndjson` and `.json` (array) files. | Should | Implemented | |
| DAT-006 | Import shall not block the UI and shall show progress (file x of n, added, duplicates, errors). | Must | Implemented | Worker thread. |
| DAT-007 | Ads already stored (same ad id) shall be skipped on import, so files may be re-imported or overlap. | Must | Implemented | |
| DAT-008 | Invalid records shall be counted and skipped without aborting the import. | Must | Implemented | Lines are split on `\n` only; U+2028/2029 occur inside texts. |
| DAT-009 | The user shall be able to see imported sources with ad counts and remove a source with its ads. | Should | Implemented | |
| DAT-010 | The application shall show total ad count, number of sources and year range covered. | Could | Implemented | |
| DAT-011 | If the database is empty at startup, the application shall open the Data sources view. | Could | Implemented | |
