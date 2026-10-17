# Non-functional requirements (NFR)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| NFR-001 | The application shall be an Electron desktop application. | Must | Implemented | |
| NFR-002 | The application shall work offline with local data (except employer logos). | Should | Implemented | |
| NFR-003 | Search and filtering over roughly 130k ads shall feel instant (list under 100 ms; facet counts under 1 s). | Should | Implemented | Measured: list a few ms, keyword up to ~30 ms, facets ~280 ms. |
| NFR-004 | The UI shall remain responsive during import and facet calculation. | Must | Implemented | Import and all database reads run in worker threads; the main process runs no database queries (measured: window shown 3 s after start on 11M ads, no main-process stall logged). |
| NFR-005 | The solution shall scale to all years (2006–2026) without redesign. | Should | In progress | D37 measured on 11.25M ads: Stockholm first page 66.6 s to 5 ms; region/field 3.95 s to 31 ms; repeated lists 1-2 ms. Shared-scan facets took 6.3-6.9 s initially, 12-13 ms when cached. All five combined-filter facets matched independent SQL. First-use broad aggregates, active obsolete queries, cold-cache variability and deep paging remain limits; rapid native filter changes were not tested. |
| NFR-006 | The renderer shall be sandboxed with context isolation and a restrictive CSP. | Must | Implemented | |
| NFR-007 | No native module compilation shall be required to build or run. | Should | Implemented | `node:sqlite`. |
| NFR-008 | The application shall run on Linux. | Must | Implemented | Other platforms untested. |
| NFR-009 | The application shall be packaged as an installable distributable. | Could | In progress | electron-builder configured (D14). Linux unpacked build launched OK; AppImage, Windows and macOS targets not built; no icon or signing. |
| NFR-010 | Filter options with counts, the total count and the ads-over-time chart shall be available within about one second of opening the search view on the full data set, also when the filter matches a single ad. | Must | In progress | D23 summaries and D37 facet reuse. Native unfiltered startup: window 598 ms, facets 19 ms end-to-end on 11.25M ads (2026-10-17). Broad uncached facets still 6-7 s; filtered counts/timelines and native rapid combine/uncombine interactions need further work/verification. |
