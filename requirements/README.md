# Requirements

Living requirements for AMS Viewer. Add new requirements to the matching file (or create a new category file) and update the index below.

## ID scheme

`<PREFIX>-<NNN>`: prefix by category, three-digit number, never reused or renumbered. Retired requirements stay in the file with status `Dropped`.

| Prefix | File | Scope |
|---|---|---|
| DAT | [data.md](data.md) | Data sources, import, storage |
| SRC | [search-filter.md](search-filter.md) | Keyword search, filters, live update |
| LST | [list.md](list.md) | Result list |
| AD | [ad-view.md](ad-view.md) | Single ad presentation |
| NAV | [navigation.md](navigation.md) | Menu, breadcrumb, back navigation, state |
| UI | [ui.md](ui.md) | Look and feel, theme, icons |
| NFR | [non-functional.md](non-functional.md) | Performance, security, platform |

## Format

Each file uses a table: `ID | Requirement | Priority | Status | Notes`.

- **Priority** (MoSCoW): Must, Should, Could.
- **Status**: `Implemented`, `Planned`, `In progress`, `Dropped`. `Implemented` means built; visual/manual verification is noted in Notes where missing.
- Requirements are phrased with "shall" and are testable.

## Adding a requirement

1. Pick the category file; use the next free number for its prefix.
2. Add a row with status `Planned`.
3. Update the status as work proceeds; reference the ID in commits/PRs.
4. Record a design consequence in [../docs/design-decisions.md](../docs/design-decisions.md) when relevant.
