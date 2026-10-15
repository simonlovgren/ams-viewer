# Selected technologies

| Area | Choice | Reason |
|---|---|---|
| Shell | **Electron 44** (Node 24, Chromium) | Requested; cross-platform desktop, full Node access in main process. |
| Database | **SQLite 3.53 via `node:sqlite`** (built into Electron's Node) | Embedded, no server, no native module rebuild (unlike `better-sqlite3`), handles millions of rows. |
| Full-text search | **SQLite FTS5**, `unicode61 remove_diacritics 2`, contentless table with `contentless_delete=1` | Fast prefix/phrase queries, BM25 ranking, diacritics-insensitive (å/ä/ö), small footprint since text is not duplicated in the index table. |
| Concurrency | **`worker_threads`** | Import and facet counting run off the main thread; SQLite WAL mode allows concurrent readers and one writer. |
| UI | **Plain HTML/CSS/JavaScript**, no framework, no bundler | Small app, no build step, easy to run and modify. |
| Icons | Inline SVG (Lucide-style paths) embedded in `app.js` | No external dependency or font loading; works offline. |
| Styling | CSS custom properties, dark teal/blue/purple/pink palette | Requested theme; gradients via `--grad`. |
| Routing | Browser History API (`pushState`/`popstate`) | Gives back/forward semantics for free; mouse back buttons and Backspace map onto it. |
| State persistence | `sessionStorage` (filters, only while the app is open), `localStorage` (tree expansion, layout) | Simple, renderer-local. |
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
