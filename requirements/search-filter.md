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
| SRC-014 | Every multi-layer filter (occupation: field/group/occupation; location: region/municipality; and any added later) shall support multiple selections on each level. Selecting a narrower item shall deselect its wider ancestors only; selections in other branches shall remain. | Must | Implemented | Selections are OR-combined per filter. Selecting a wider item drops its narrower descendants (redundant). Verified by code and DB queries; UI not seen. |
| SRC-015 | Filter options shall not change due to filtering: all available options remain visible even if no filtered ad matches. Each option shall still show its ad count (0 if none) and remain selectable, with grayed-out text signalling that selecting it will not affect the current view. | Must | Implemented | Applies to occupation and location trees, year, employment and working-hours chips. Counts exclude the option's own filter (SRC-009). Verified by DB queries; gray styling not seen. |
| SRC-016 | The free-text search shall support multiple free-text entries. Typing text and pressing Enter shall add it as a free-text filter, displayed as a box with an "X" inside the search input (like the other filter chips) to show it is applied. The "X" shall remove the entry; Backspace with the cursor directly after the last box shall also remove it. | Must | Implemented | Entries and the text being typed are AND-ed; typed text still filters live. Verified by DB query and syntax check; UI interaction not seen. |
| SRC-017 | At the top of the filter sidebar there shall be a line graph of the number of ads published across the selected time period (the date filter, or the whole data range when none is set), reflecting the other active filters. The axis labelling and bin size shall adapt to the span: years for many years; years (at January) and months for a few years; months for about one year; months (at the first of the month) and weeks for a few months; down to individual days for short spans. | Should | Implemented | Bins: year > ~6 y, month 150 days to 6 y, week 45 to 150 days, day otherwise. Hover shows the count per bin. Counts verified by DB queries (sums match); rendering and label layout not seen in the UI. |
