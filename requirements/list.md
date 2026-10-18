# List requirements (LST)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| LST-001 | Each list entry shall show date, location, occupation information and title. | Must | Implemented | Also employer. |
| LST-002 | Location, occupation field/group/occupation and other attributes shall be shown as colored tags. | Must | Implemented | Location teal, field blue, group purple, occupation pink, other grey. D48 repairs stale imported array-valued tag columns; native post-migration listing remains unverified. |
| LST-003 | The list shall stay slim and sleek; extra information shall be limited to relevant tidbits. | Should | Implemented | Employer, working hours, employment type. |
| LST-004 | The list shall load incrementally while scrolling. | Should | Implemented | 60 per page. |
| LST-005 | The total number of matching ads shall be displayed. | Should | Implemented | |
| LST-006 | An empty result shall display a clear message. | Could | Implemented | |
| LST-007 | List entries shall be keyboard accessible (focus, Enter to open). | Could | Implemented | |
| LST-008 | The list scroll position shall be restored when returning from an ad. | Must | Implemented | |
| LST-009 | The app shall provide one default favorite list named "Favorites". | Must | Planned | T11; not implemented. Whether the default list can be deleted remains to be decided. |
| LST-010 | Users shall be able to create additional favorite lists with custom names and delete those custom lists. | Must | Planned | T11; not implemented. |
| LST-011 | Ads shall have a star-icon action that opens a popover listing the available favorite lists; selecting a list shall add the current ad to that list. | Must | Planned | T11; not implemented. |
| LST-012 | The last entry in the favorite-list popover shall be a plus (+) control; activating it shall replace that entry with a list-name input and an "Add" button on its right. | Must | Planned | T11; not implemented. |
| LST-013 | After the user enters a name and presses "Add" in the favorite-list popover, the app shall create the named list and add the ad whose star action opened the popover to the new list. | Must | Planned | T11; not implemented. Creating the list shall not require restarting the ad's favorite action. |
