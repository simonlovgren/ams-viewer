# AMS Viewer – Documentation

Desktop application for browsing historical Swedish job ads (Arbetsförmedlingen / JobTech open data, 2006–2026).

| Document | Contents |
|---|---|
| [system-description.md](system-description.md) | What the app does, architecture, data flow, UI structure |
| [technologies.md](technologies.md) | Selected technologies and why |
| [design-decisions.md](design-decisions.md) | Key design decisions with rationale and alternatives |
| [constraints.md](constraints.md) | Technical, data and scope constraints, known limitations |
| [data-model.md](data-model.md) | Source record format, database schema, indexes |

## Quick start

```bash
npm install
npm start
```

Then open **Data sources** and import one or more `.jsonl` / `.ndjson` / `.json` files.
The database is stored at `~/.config/ams-viewer/ads.db` (Electron `userData`).
