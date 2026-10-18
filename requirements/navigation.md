# Navigation requirements (NAV)

| ID | Requirement | Priority | Status | Notes |
|---|---|---|---|---|
| NAV-001 | A side menu shall let the user jump to the overall search at any time. | Must | Implemented | Also Datasets. |
| NAV-002 | Menu items and filter headings shall use icons together with text. | Must | Implemented | Inline SVG. |
| NAV-003 | The ad view shall have a breadcrumb: Search, field, group, occupation, title. | Must | Implemented | |
| NAV-004 | The ad view shall have a back button. | Must | Implemented | |
| NAV-005 | Backspace (outside text inputs) shall navigate back. | Must | Implemented | |
| NAV-006 | The mouse back button shall navigate back; the forward button forward. | Must | Implemented | Verified by code only. |
| NAV-007 | Navigation shall follow browser-style history across list, ad and data views. | Should | Implemented | History API. |
| NAV-008 | Alt+Left/Right shall navigate back/forward; `/` shall focus the search box. | Could | Implemented | D29: outside editable controls, focus in-ad find on the ad view without navigating; otherwise open/focus list search. Renderer regressions and browser keyboard fixture passed; real Electron interaction not manually tested. |
| NAV-009 | The side menu shall provide a top-level Settings page, separate from search and ad views, supporting browser-style back/forward navigation and future application settings. | Must | Implemented | D26: Appearance section with UI-016. Existing History API and hidden views preserve search context; renderer tests and browser keyboard/history checks passed. |
| NAV-010 | Keyboard shortcuts shall preserve the same user intent across views, while allowing view-specific targets and actions rather than requiring identical functions. | Must | Implemented | D29 routes `/` to in-ad find or list search according to context; D31 documents the active behavior. |
| NAV-011 | Pressing `?` outside editable controls shall open a sleek keyboard-shortcut help modal listing all shortcuts relevant to the current view, including global shortcuts, with a short description of each shortcut's action in that context. | Must | Implemented | D31: accessible modal, view-specific entries, editable controls unaffected, Escape/close dismissal and focus restoration. Browser fixture and renderer tests passed; real Electron interaction not manually tested. |
