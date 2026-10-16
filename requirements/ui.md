# UI requirements (UI)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| UI-001 | The application shall have a modern, sleek UI. | Must | Implemented | Not yet visually reviewed. |
| UI-002 | The application shall use a dark theme. | Must | Implemented | |
| UI-003 | The color scheme shall favor teal, blue, purple and pink. | Must | Implemented | CSS variables in `styles.css`. |
| UI-004 | Related information (location, occupation levels, etc.) shall be distinguishable by consistent tag colors. | Must | Implemented | See LST-002. |
| UI-005 | Updates shall not reload the page or reset the user's context. | Must | Implemented | |
| UI-006 | The window shall have a minimum usable size. | Could | Implemented | 960x600. |
| UI-007 | The filter sidebar shall be resizable in width, with its current width as the minimum. | Should | Implemented | Drag handle on its right edge; max 720 px or 60% of the window; width saved in `localStorage`. Not seen in the UI. |
| UI-008 | The filter sidebar shall be collapsible and expandable so the list can use the full width. | Should | Implemented | Toggle button left of the search box; state saved. Not seen in the UI. |
| UI-009 | The main menu shall be collapsible to icons only, and shall be collapsed by default. | Should | Implemented | Toggle at the bottom of the menu (labels get tooltips); state saved. Not seen in the UI. |
| UI-010 | Filter boxes with hierarchical selection (occupation, location) shall be resizable up/down so more of the tree can be viewed vertically. | Should | Planned | Not started. See docs/tasks.md. |
| UI-011 | The filter widgets in the filter sidebar and the statistics widgets in the statistics bar shall each be collapsible and expandable by pressing their title. | Should | Planned | Not started. See docs/tasks.md. |
| UI-012 | The UI shall use monospace font(s) to give it the feel of a data inspection tool. | Should | Implemented | D26: all main-window text, including headings and ad descriptions, uses an offline system monospace stack by default. Browser fixture layout checked at 960x600 and 1400x900; Electron startup verified. |
| UI-013 | The search view shall have a statistics bar on its right-hand side, which holds the graphs and other statistics widgets (they are not placed in the filter column). The bar itself shall be collapsible, and each statistics widget shall be collapsible (UI-011). | Should | Planned | Not started. Moves the ads-over-time chart (SRC-017) out of the filter sidebar; hosts the map (SRC-019) and the employers widget (SRC-020). See docs/tasks.md. |
| UI-014 | While the application starts and loads its data, a splash screen with a loading progress bar shall be shown, so it is clear that the application is starting. | Must | Implemented | Frameless splash window with stage text, percentage and elapsed time; closes when the main window has its first results. Layout not seen by the agent (window opened, not viewed). |
| UI-015 | Large ad counts in the UI shall use compact, human-readable notation, with exact counts available on hover. | Must | Implemented | D25: shared compact formatter (e.g. 12.5k, 11.3M); exact hover values in filters, totals, chart and import counts. Boundary tests and Electron startup verified; visual layout not reviewed. |
| UI-016 | Settings shall provide a monospace on/off option that applies immediately to all main-window text and persists across application restarts; monospace shall be enabled by default. | Must | Implemented | D26: Settings > Appearance slider-style switch; localStorage settings object. Unit tests and browser reload verified; actual Electron quit/relaunch preference retention not manually tested. |
