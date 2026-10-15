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
