# AMS Viewer – Documentation

Desktop application for browsing historical Swedish job ads (Arbetsförmedlingen / JobTech open data, 2006–2026).

| Document | Contents |
|---|---|
| [system-description.md](system-description.md) | What the app does, architecture, data flow, UI structure |
| [technologies.md](technologies.md) | Selected technologies and why |
| [design-decisions.md](design-decisions.md) | Key design decisions with rationale and alternatives |
| [constraints.md](constraints.md) | Technical, data and scope constraints, known limitations |
| [data-model.md](data-model.md) | Source record format, database schema, indexes |
| [tasks.md](tasks.md) | Planned work that is specified but not started |
| [theming.md](theming.md) | JSON theme contract, complete color/font reference and staged implementation/verification (T19) |
| [full-scale-performance-plan.md](full-scale-performance-plan.md) | Top-priority investigation and optimization plan for the full dataset (NFR-003/004/005) |
| [developer-notes/](developer-notes/README.md) | Memory bank for future sessions: gotchas, testing recipes, project state |

## Quick start

```bash
npm install
npm start
```

Select a dataset in the startup window and press **Open dataset**. The last opened dataset is preselected; no database loading or automatic enrichment begins until confirmation. Then open **Datasets** and import one or more `.jsonl` / `.ndjson` / `.json` files. An empty installation offers **default** and opens Datasets after confirmation; imported sources can be removed there without deleting the original files.

Dataset catalog and databases live in Electron's `userData` folder: `~/.config/AMS Viewer/` on Linux, `~/Library/Application Support/AMS Viewer/` on macOS, or `%APPDATA%\AMS Viewer\` on Windows. The catalog is `datasets.json`; each dataset has a separate database under `datasets/`. Existing `ads.db` is migrated on first startup; back up the data folder before upgrading.
