# Data model

## Source record (JSONL, one object per line)

Relevant fields used by the app:

| JSON path | Used for |
|---|---|
| `id` | Primary identity (`ads.ad_id`) |
| `headline` | Title, FTS |
| `description.text` | Description, FTS |
| `employer.name` / `workplace` / `organization_number` / `email` / `phone_number` / `url` | Employer name, ad view |
| `publication_date` | `pub_date`, `year`, date filters, list date |
| `application_deadline` | `deadline`, ad view |
| `workplace_address.region` / `municipality` / address fields | Location filters/tags, ad view |
| `occupation_field` / `occupation_group` / `occupation` (`concept_id`, `label`) | Occupation hierarchy |
| `employment_type.label`, `working_hours_type.label`, `scope_of_work`, `duration`, `salary_type`, `salary_description`, `number_of_vacancies` | Filters and "At a glance" |
| `must_have`, `nice_to_have` | Requirement cards |
| `application_details`, `application_contacts`, `webpage_url` | How to apply, apply button |
| `driving_license`, `access_to_own_car`, `experience_required` | Facts |
| `logo_url` | Employer logo |

All other fields are kept in `raw` (after pruning nulls, empty strings and empty arrays/objects).

## Dataset catalog and database paths

`<userData>/datasets.json` stores catalog version, active dataset ID, and each dataset's stable generated ID, editable name, multiline description, initialized flag, and optional cached summary (`total`, `sourceCount`, `min`, `max`). Names are metadata only and never used as filesystem paths. `default` uses `datasets/default.db`; other datasets use `datasets/<generated-id>.db`. Each database has the same schema below, its own WAL/SHM files, source rows, ads and summary tables.

Summary snapshots refresh from the active database at startup, after activation, import completion and source removal. Missing snapshots from older catalogs are backfilled by a temporary read worker using only `sources` metadata; no ad-table scan or main-process DB access is needed. Statistics are marked unavailable per entry if a legacy database cannot be read.

On first startup after upgrading, legacy `<userData>/ads.db` and its SQLite sidecars are renamed into `datasets/default.db`; no data copy or re-import occurs. A migration marker allows startup to resume partial moves. Conflicting files stop migration rather than overwrite either DB. Catalog writes use atomic replacement. If deletion file staging is interrupted before catalog removal, startup restores staged files for datasets still registered in the catalog.

## Application theme selection

`<userData>/themes.json` is separate from datasets and currently stores `{ "version": 1, "activeId": "ams-dark" }` or the same shape with `ams-light` (D52/T19 stage 3). The main-process theme catalog validates selection at startup and atomically replaces this file before applying a change. Missing means the dark default; invalid/unavailable/oversized selection falls back with a warning without overwriting the original file. Font mode remains in renderer application settings, not this catalog. Built-in theme data is bundled under `src/themes/` and follows the separate `schemaVersion: 1` contract in [theming.md](theming.md). Imported-theme catalog entries are deferred to stage 4; extending the format must retain stage-3 compatibility. No SQLite schema or re-import change.

## Database schema (per dataset, WAL mode)

```sql
ads(
  rowid INTEGER PRIMARY KEY,
  ad_id TEXT UNIQUE NOT NULL,
  headline, pub_date TEXT, year INTEGER, deadline TEXT, employer TEXT,
  region TEXT, muni TEXT,
  field_id, field, group_id, grp, occ_id, occ,
  emp_type TEXT, hours TEXT,
  source TEXT,           -- import file name
  raw TEXT               -- pruned JSON of the full record
)

ads_fts USING fts5(headline, employer, body,
  content='', contentless_delete=1,
  tokenize='unicode61 remove_diacritics 2')   -- rowid = ads.rowid

sources(name TEXT PRIMARY KEY, path TEXT, ads INTEGER, imported_at TEXT)
meta(key PRIMARY KEY, value)                    -- summary_version = '2' once summary tables are built
sum_occ(field_id, field, group_id, grp, occ_id, occ, n)  -- PK (field_id, group_id, occ_id)
sum_loc(region, muni, n)   sum_year(year, n)   sum_emp(v, n)   sum_hours(v, n)   sum_day(day, n)
sum_employer(v, n)         -- exact employer text and total count; included in summary version 2
```

### Indexes

| Index | Purpose |
|---|---|
| `ix_pub (pub_date)`, `ix_year (year)` | Date sort/range, year facet |
| `ix_occ_cov (field_id, group_id, occ_id, field, grp, occ)` | Occupation filter + covering facet scan |
| `ix_group`, `ix_occ` | Direct group/occupation filters |
| `ix_loc_cov (region, muni)` | Location filter + facet scan |
| `ix_source (source)` | Removing a source |
| `ix_employer (employer COLLATE BINARY, pub_date)` | Exact employer filters; covering counts and timeline date reads (D46) |

`ix_employer` is created once by `ensureSummary()` in the build worker, including on databases whose summary version is already 2. It is not built when opening read connections. Startup/activation reports indexing progress; no re-import or summary rebuild is needed. SQLite maintains the index on subsequent imports/removals.

### Promoted array-tag repair (D48)

`ensureSummary()` also checks `meta.array_tags_version`. When absent, it scans for missing promoted taxonomy IDs/labels, employment or hours backed by array-valued fields in `raw`, normalizes with `toRow()` and fills only NULL columns in 500-row transactions. Raw JSON and existing values stay unchanged. Changed batches atomically invalidate `summary_version`; summaries rebuild before the build task completes. The marker becomes `'1'` only after the scan, so interrupted repairs retry safely. This runs once per dataset on startup/activation, not on every connection open; no re-import is required.

### Manual reprocessing (DAT-026, D49)

Manual reprocessing (DAT-026, D49) reads stored `raw` in 500-row batches within one build-worker transaction. Current `toRow()` rules replace all promoted columns except identity/source/raw, including stale non-null values. It clears and repopulates contentless `ads_fts` with preserved rowids, regenerates every `sum_*` table and per-source ad count, ensures deferred employer/employment/hours indexes, runs `REINDEX` and `ANALYZE`, and marks summary/array-tag migrations complete. Original raw JSON, ad IDs, source paths/import timestamps and catalog metadata are preserved. Empty datasets and repeated runs are supported; failure rolls back every database change. Catalog statistics refresh after commit. No original source files or re-import are needed; missing information absent from stored raw JSON cannot be recovered.

## Filter object (renderer ↔ main)

```js
{ q, terms, termMode, sel, loc, employers, from, to, emp, hours, sort }
```

`terms` is an array of committed free-text entries (added with Enter; text still being typed is not part of the filter; the backend still accepts a legacy `q`); `termMode` (`and` | `or`) selects how entries are combined; each entry is an AND of its own words (see `ftsMatch()` in `db.js`). `sel` is an array of `{ k: 'field'|'group'|'occ', id, label, fi, gi }` (occupation selections) and `loc` an array of `{ k: 'region'|'muni', id, label, ri }` (location selections); each list is OR-combined.
Dates are `YYYY-MM-DD` strings compared lexicographically. `sort` is `newest | oldest | relevance`.

`employers` is an array of exact stored employer-name strings, default `[]`. Values are OR-combined by parameterized `ads.employer COLLATE BINARY IN (...)`; all other dimensions are AND-combined with this predicate. Names are not trimmed, normalized or folded; case and spelling variants remain distinct. Every shared query, including employer statistics, applies this filter. Unlike regular facet options, Top-30 employers remain statistics over all active filters, not an own-filter-excluded option universe (D45/SRC-020/SRC-022). Session persistence, ad return, Clear all and dataset reset use the existing renderer filter lifecycle.

## Adding a new filter dimension

1. Reuse a suitable stored column when available; otherwise add a column (and index) in `db.js` `SCHEMA` and populate it in `toRow()`/`INSERT_SQL`.
2. Handle it in `where()`. For a regular own-filter-excluded facet, add its definition to `FACETS` and keys to the materialized facet projection (D37). A statistics-driven filter such as `employers` reuses its existing filtered statistics query instead.
3. Add UI in `index.html`/`app.js` and include it in `DEF`, `renderActive()`.
4. If stored columns changed, migrate/backfill or re-import the data (existing rows are skipped by id, so remove the source first). Employer filtering needs only the automatic background index migration (D46), not re-import.

## Source data generations (files in `~/storage/ams_data`, checked 2026-10-15)

| Years | Format | `id` | Taxonomy (field/group/occupation) | Location | Other |
|---|---|---|---|---|---|
| 2006–2016 | `.jsonl` | null (synthetic `h-<sha1>`) | empty | empty | dates `YYYY-MM-DD`; hours present |
| 2017 | `.jsonl` | string `0017-nnnnnn` | empty | empty | |
| 2018, 2019 | `.json` array (3.5–3.6 GB, one line) | number | present | municipality and region present | dates `YYYY-MM-DD HH:MM:SS,000000000`; `*_municipality_patched.zip` exist (not used) |
| 2020–2022 | `.jsonl` | string | present, objects | municipality in ~52% (2020) to ~98% | |
| 2023–2026 | `.jsonl` | 40-char hash | arrays of objects | present | employment type is an array; first element stored |

The folder also holds `.zip`/`.zst` copies, which the importer does not accept. `publication_date` is cut to its first 10 characters, which works for both date formats.
