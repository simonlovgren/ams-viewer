# Developer notes (memory bank)

Notes for future agent sessions and developers. Read these before starting work; add to them when you learn something that would save the next session time.

| File | Contents |
|---|---|
| [gotchas.md](gotchas.md) | Pitfalls, non-obvious behaviors, things that broke once |
| [testing-recipes.md](testing-recipes.md) | Ready-to-run commands for verifying changes without the UI |
| [project-state.md](project-state.md) | Current state, unverified areas, open ideas, user preferences |

## What belongs here

- Non-obvious facts about the data, tools or environment that cost time to discover.
- Verified commands and recipes.
- Decisions of working style or user preferences that are not requirements.
- Open items and ideas that are not (yet) requirements.

## What does not belong here

- Requirements: `requirements/`. Major design decisions: `docs/design-decisions.md`. Architecture and data model: the other docs. Link to them instead of duplicating.

## Rules

- Keep entries short, factual and dated when time-sensitive (`2026-10-15`).
- Update or delete notes that turn out wrong or obsolete.
- Prefer appending to an existing file; create a new file only for a new topic and add it to the table above.
- Every new long-running or background operation needs an application-wide top status notification and progress bar (indeterminate when progress is unknown), using the existing UI-022/D47 task flow. Always end the running notice on success or failure; failures need a dismissible error status notification even when also reported in a modal.
- Include relevant one-off messages for failures, blocked actions, warnings and outcomes that would otherwise be unclear. Reuse existing notices or UI-018 dialogs rather than silent console-only reporting or native alert/confirm popups; avoid flashing success notices for routine fast work.
