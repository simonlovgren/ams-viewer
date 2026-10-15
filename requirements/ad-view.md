# Ad view requirements (AD)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| AD-001 | An ad shall be presented as close as possible to a real job ad, not as a table or JSON. | Must | Implemented | Hero header, formatted description, side panels. |
| AD-002 | The header shall show title, employer, logo (with fallback) and colored tags. | Must | Implemented | Logo loaded from remote URL. |
| AD-003 | The description shall be formatted with paragraphs, headings and lists where detectable. | Should | Implemented | Heuristic, from plain text. |
| AD-004 | The ad shall show key facts: publication and last application date, employment, hours, duration, salary, vacancies, workplace, driving licence, experience. | Must | Implemented | |
| AD-005 | The ad shall show requirements and nice-to-have items (skills, languages, experience, education). | Should | Implemented | |
| AD-006 | The ad shall show how to apply, contacts and employer details. | Should | Implemented | |
| AD-007 | An external application page link shall open in the system browser (http/https only). | Should | Implemented | |
| AD-008 | Tags and breadcrumb items shall apply the corresponding filter and go to the list. | Should | Implemented | |
| AD-009 | Ad text shall be rendered safely (escaped; no HTML from source). | Must | Implemented | |
