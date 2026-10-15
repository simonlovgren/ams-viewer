# Search and filter requirements (SRC)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| SRC-001 | The user shall be able to filter on occupation field, occupation group and occupation. | Must | Implemented | Collapsible tree with counts; deepest selected level applies. |
| SRC-002 | The user shall be able to filter on location (region and municipality). | Must | Implemented | Tree with counts. |
| SRC-003 | The user shall be able to search by keyword. | Must | Implemented | Headline, employer, description; phrases in quotes; prefix matching. |
| SRC-004 | The user shall be able to filter by publication date range. | Must | Implemented | From/to date inputs. |
| SRC-005 | The user shall be able to filter by year with one click. | Should | Implemented | Year chips with counts. |
| SRC-006 | The user shall be able to filter by employment type. | Should | Implemented | |
| SRC-007 | The user shall be able to filter by working hours. | Should | Implemented | |
| SRC-008 | The list shall update dynamically as filters change, without reloading the page. | Must | Implemented | Keyword input debounced. |
| SRC-009 | Filter options shall show counts reflecting the other active filters. | Should | Implemented | Own-filter excluded per group. |
| SRC-010 | Active filters shall be shown as removable chips, with a "Clear all" action. | Should | Implemented | |
| SRC-011 | The user shall be able to sort by newest, oldest and (with keyword) relevance. | Should | Implemented | |
| SRC-012 | The occupation and location trees shall be searchable by text. | Could | Implemented | |
| SRC-013 | Filters shall be remembered when opening an ad and returning to the list, and across restarts. | Must | Implemented | Kept in memory and `localStorage`. |
| SRC-014 | The occupation filter shall support multiple selections on each level (field, group, occupation). Selecting a narrower item shall deselect its wider ancestors only; selections in other branches shall remain. | Must | Implemented | Selections are OR-combined. Selecting a wider item drops its narrower descendants (redundant). Verified by code and DB query; UI not seen. |
