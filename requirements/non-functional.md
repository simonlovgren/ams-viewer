# Non-functional requirements (NFR)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| NFR-001 | The application shall be an Electron desktop application. | Must | Implemented | |
| NFR-002 | The application shall work offline with local data (except employer logos). | Should | Implemented | |
| NFR-003 | Search and filtering over roughly 130k ads shall feel instant (list under 100 ms; facet counts under 1 s). | Should | Implemented | Measured: list a few ms, keyword up to ~30 ms, facets ~280 ms. |
| NFR-004 | The UI shall remain responsive during import and facet calculation. | Must | Implemented | Import and all database reads run in worker threads; the main process runs no database queries (measured: window shown 3 s after start on 11M ads, no main-process stall logged). |
| NFR-005 | The solution shall scale to all years (2006–2026) without redesign. | Should | In progress | Measured at 926k ads (2006 + 2018): list 13 ms, keyword 186 ms, facets 0.3 s warm, 0.5–1.5 s filtered, 2.4 s cold. All files are now imported (11.25M ads, ~70 GB). Startup is fast (window in ~3 s, D22); filtered counts, facets and the timeline are still slow on cold data and need a summary table or caching later; see docs/tasks.md T6 (reduced priority) and docs/constraints.md. |
| NFR-006 | The renderer shall be sandboxed with context isolation and a restrictive CSP. | Must | Implemented | |
| NFR-007 | No native module compilation shall be required to build or run. | Should | Implemented | `node:sqlite`. |
| NFR-008 | The application shall run on Linux. | Must | Implemented | Other platforms untested. |
| NFR-009 | The application shall be packaged as an installable distributable. | Could | In progress | electron-builder configured (D14). Linux unpacked build launched OK; AppImage, Windows and macOS targets not built; no icon or signing. |
