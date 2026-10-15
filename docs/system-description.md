# System description

## Purpose

Browse, filter and read historical job ads offline. Source data is published as one JSONL file per period (e.g. `2026-Q3.jsonl`, ~770 MB, ~130k ads). The app imports such files into a local database and offers a fast, dark-themed UI on top.

## Functional overview

- **Search view**: filter panel (left) + keyword box, sort and result list (right).
  - Keyword search (headline, employer, description), with `"phrases"` and prefix matching.
  - Hierarchical filters: occupation field → group → occupation; region → municipality.
  - Date range and one-click year chips; employment type; working hours.
  - Sort: newest, oldest, relevance (keyword only).
  - Results update live while typing/selecting; the list loads incrementally while scrolling.
  - Active filters shown as removable chips; "Clear all".
- **Ad view**: job-ad style presentation (hero header, formatted description, requirements, how to apply, at-a-glance facts, employer info), with a clickable breadcrumb and clickable tags that apply filters.
- **Data sources view**: import (file picker or drag & drop, multiple files), progress, per-source removal, totals.
- **Navigation**: sidebar menu; Backspace, mouse back/forward buttons and Alt+←/→ move through view history; `/` focuses search.
- **Persistence of state**: filters and tree expansion are saved in `localStorage`; the list view is kept alive (hidden) while an ad is open, preserving scroll position.

## Architecture

```mermaid
flowchart LR
  subgraph Renderer[Renderer process - sandboxed]
    UI[index.html / styles.css / app.js]
  end
  subgraph Main[Main process]
    M[main.js - window, IPC]
    D[db.js - schema, queries]
  end
  FW[facets-worker.js]
  IW[import-worker.js]
  DB[(SQLite ads.db<br/>WAL mode)]
  UI -- contextBridge API --> P[preload.js]
  P -- IPC invoke --> M
  M --> D --> DB
  M -- message --> FW --> DB
  M -- spawn --> IW --> DB
  IW -- progress events --> M -- IPC event --> UI
```

### Components

| File | Role |
|---|---|
| `src/main/main.js` | Creates the window, registers IPC handlers, spawns workers, validates input (file extensions, URL scheme). |
| `src/main/preload.js` | Exposes a minimal `window.api` via `contextBridge`. |
| `src/main/db.js` | Schema, row mapping, filter → SQL builder, search, facets, ad lookup, source removal. Shared by main and workers. |
| `src/main/import-worker.js` | Streams a file, maps records, inserts into `ads` and `ads_fts` in batched transactions, reports progress. |
| `src/main/facets-worker.js` | Runs facet-count queries on its own DB connection so the main thread stays responsive. |
| `src/renderer/app.js` | All UI logic: state, history, list, filter trees, ad rendering, data view. No framework. |

## Data flow

1. **Import**: renderer asks main to import → main starts `import-worker` → worker streams records → rows + FTS entries inserted (duplicates by ad id skipped) → progress events relayed to the UI → on completion the list and facets reload.
2. **Search**: filter change → `setF` saves state → `ads:search` (page of 60 + total on first page) and `ads:facets` (counts for all filter panels) run in parallel. Stale responses are discarded via sequence counters.
3. **Open ad**: row click → history `pushState` → `ads:get` returns the stored (null-pruned) JSON → rendered as a job ad.

## Facet semantics

Each filter group's counts are computed with all *other* filters applied but its own ignored. This lets the user see alternatives within a group (e.g. other occupation fields) while still reflecting keyword, date and location choices.
