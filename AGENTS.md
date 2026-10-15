# Working in this project

AMS Viewer: Electron app for browsing historical Swedish job ads. Start with [docs/README.md](docs/README.md) and [requirements/README.md](requirements/README.md).

## Source of truth

| Artifact | Location | Rule |
|---|---|---|
| Requirements | `requirements/*.md` | Authoritative for what the app shall do. |
| Design decisions | `docs/design-decisions.md` | Why it is built this way. Each decision lists the requirement IDs it serves. |
| System, technologies, constraints, data model | `docs/*.md` | How it is built and its limits. |
| Code | `src/main/` (Electron main, DB, workers), `src/renderer/` (UI) | Must conform to the above. |

## Workflow for every change

1. **Find the requirement.** Locate the ID(s) in `requirements/` that the work relates to.
   - New behavior with no matching requirement: add the requirement first (next free number in the right category file, status `Planned`) and tell the user what was added. If the request is ambiguous or conflicts with an existing requirement, ask before proceeding.
2. **Never contradict a requirement.** If a change requires altering one, stop and confirm with the user; then update the requirement (do not renumber; mark obsolete ones `Dropped`).
3. **Implement** within the existing structure and technologies (see `docs/technologies.md`). Do not add frameworks, bundlers or native modules without a recorded decision.
4. **Trace decisions.** Any major decision (new dependency, schema change, new process/worker, security-relevant change, change of UX behavior, performance trade-off) shall be added to `docs/design-decisions.md` as the next `D<n>` with a `**Requirements**:` line naming at least one requirement ID. A decision without a requirement ID is not allowed: either find the requirement it serves or add one.
5. **Update documentation** in the same change:
   - Requirement status in `requirements/*.md` (`Planned` → `In progress` → `Implemented`); note in the Notes column what is not verified.
   - `docs/constraints.md` for new limits or known issues.
   - `docs/data-model.md` for schema, index or filter-object changes (includes the "Adding a new filter dimension" steps).
   - `docs/system-description.md` for architecture or data-flow changes; `docs/technologies.md` for stack changes.
6. **Verify** before marking `Implemented`: run the app (`npm start`) or the relevant script, check `node --check` / editor errors, and state honestly what was not tested (e.g. visual layout).

## Conventions

- **Requirement IDs**: `PREFIX-NNN` (DAT, SRC, LST, AD, NAV, UI, NFR); never reuse or renumber. Reference them in commit messages, e.g. `SRC-009: exclude own filter from facet counts`.
- **Stack**: Electron + `node:sqlite` (FTS5) + worker threads + plain JS/HTML/CSS. No build step.
- **Security**: keep `contextIsolation`, `sandbox`, no `nodeIntegration`, CSP. Escape every dynamic value in the renderer with `esc()`; never inject source-ad HTML. Validate all IPC input in the main process (file extensions, `http(s)` URLs).
- **Performance**: keep long-running DB work (import, facets) off the main thread. Interactive queries must stay in the low-millisecond range at ~130k ads and scale to all years (NFR-005).
- **Data**: the DB is a derived copy of the source files in `~/.config/AMS Viewer/ads.db`. Do not commit data files or the database. Schema changes need a migration or a documented re-import.
- **UI language** is English; ad content is Swedish. Tag colors are fixed by meaning (LST-002, UI-004): location teal, field blue, group purple, occupation pink, other grey.
- **Python**: if a script needs Python, use a virtual environment created with `uv`; do not use system Python.
- **Style**: keep changes minimal and focused; comments only where code cannot explain itself.

## Commands

```bash
npm install     # dependencies
npm start       # run the app (add --no-sandbox if the Electron sandbox helper is missing)
```

## Developer notes

`docs/developer-notes/` is a memory bank for future sessions: read it first, and add gotchas, verified recipes, project state and user preferences when you learn something useful. See its [README](docs/developer-notes/README.md).

## Commits

The user makes all commits. Never run `git commit`, `git push`, `git add`/staging on your own, or anything that rewrites history.

When a large enough coherent change is complete (a finished requirement or feature, a bug fix with its docs and notes, a refactor), stop and suggest creating a commit:

- Say that this is a good commit point and what the commit would contain; if unrelated changes have piled up, suggest how to split them.
- Propose the message: Conventional Commits subject (50 characters or less), a short body when the why is not obvious, and the requirement and decision IDs involved (for example `SRC-009`, `D6`).
- Then wait for the user; carry on with new work only when asked.

Do not suggest a commit for tiny edits or work that is half done or unverified.

## Definition of done

- Related requirement IDs exist and statuses are current.
- Major decisions are recorded with requirement IDs.
- Affected docs are updated.
- Developer notes updated with anything useful for future sessions.
- Behavior verified, and unverified parts stated.
