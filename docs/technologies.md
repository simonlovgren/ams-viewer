# Selected technologies

| Area | Choice | Reason |
|---|---|---|
| Shell | **Electron 44** (Node 24, Chromium) | Requested; cross-platform desktop, full Node access in main process. |
| Database | **SQLite 3.53 via `node:sqlite`** (built into Electron's Node) | Embedded, no server, no native module rebuild (unlike `better-sqlite3`), handles millions of rows. |
| Full-text search | **SQLite FTS5**, `unicode61 remove_diacritics 2`, contentless table with `contentless_delete=1` | Fast prefix/phrase queries, BM25 ranking, diacritics-insensitive (å/ä/ö), small footprint since text is not duplicated in the index table. |
| Concurrency | **`worker_threads`** | Import and facet counting run off the main thread; SQLite WAL mode allows concurrent readers and one writer. |
| UI | **Plain HTML/CSS/JavaScript**, no framework, no bundler | Small app, no build step, easy to run and modify. |
| Icons | Inline SVG (Lucide-style paths) embedded in `app.js` | No external dependency or font loading; works offline. |
| Styling | Versioned JSON colors/fonts, shared plain-JS validation, CSS custom properties | D51-D54: built-in/imported palettes and local font stacks, bounded JSON library, pre-paint persisted selection and self-themed native-dialog chooser. No new framework/dependency; gradients remain CSS. |
| Routing | Browser History API (`pushState`/`popstate`) | Gives back/forward semantics for free; mouse back buttons and Backspace map onto it. |
| State persistence | `sessionStorage` (filters), `localStorage` (layout/font mode), main-owned `themes.json` (active theme) | Theme selection is application-wide and available before windows paint; renderer preferences remain independent (D52). |
| Security | `contextIsolation`, `sandbox`, no `nodeIntegration`, CSP, `contextBridge` | Standard Electron hardening; ad content is untrusted data. |
| Packaging | **electron-builder** (dev dependency) | AppImage / NSIS / dmg from `package.json` config (D14). |

## Considered and not chosen

| Alternative | Why not |
|---|---|
| `better-sqlite3` | Native module; needs rebuild against Electron's ABI. `node:sqlite` is sufficient. |
| Document DB (LokiJS, PouchDB, NeDB) | Weak or no full-text search, poor performance at millions of documents, in-memory designs. |
| Reading JSONL files directly | 770 MB per file; no indexed filtering or search without loading everything. |
| React/Vue + bundler | Adds tooling for a small UI; not needed. |
| Elasticsearch / external server | Violates the "single desktop app" goal. |

`node:sqlite` is flagged experimental in Node 24 (prints a warning in plain Node); its API has been stable for this use. Pin the Electron version when upgrading and re-test.
