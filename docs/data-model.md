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

`<userData>/themes.json` is separate from datasets. Version 1 accepts the stage-3 `{ "version": 1, "activeId": "ams-dark" }` form and optionally adds `themes: [{id, name}]` for custom themes (D52/D53). IDs are built-in names or generated `theme-<UUID>` strings; custom names are metadata only. Each custom copy is `themes/<id>.json`, following the separate complete `schemaVersion: 1` contract in [theming.md](theming.md). The optional metadata array is omitted when empty. Catalog and individual theme files are bounded to 64 KiB.

Import commits the copy before catalog metadata and rolls it back on metadata failure; selection changes persist before window updates. Removal stages a file as `<id>.json.removing`, commits metadata/fallback and then unlinks it. Startup restores stages still registered and cleans stages for removed IDs; unregistered import orphans are ignored. Missing/corrupt custom files remain catalog entries with unavailable state; valid entries remain usable. Invalid/unavailable active selection falls back to dark with a warning, preserving evidence until a successful library mutation. Font mode remains in renderer settings. Built-ins are bundled under `src/themes/`; none of this changes SQLite schemas, dataset catalogs or re-import requirements.

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
  raw TEXT,              -- pruned JSON of the full record
  employer_id TEXT,      -- trimmed organization_number; NULL when absent
  legacy_occ_id TEXT,    -- occupation.legacy_ams_taxonomy_id
  legacy_muni_code TEXT  -- workplace_address.municipality_code
)

ads_fts USING fts5(headline, employer, body,
  content='', contentless_delete=1,
  tokenize='unicode61 remove_diacritics 2')   -- rowid = ads.rowid

sources(name TEXT PRIMARY KEY, path TEXT, ads INTEGER, imported_at TEXT)
meta(key PRIMARY KEY, value)                    -- summary_version = '2', employer_identity_version = '1', legacy_enrichment_version = '1' once ready
sum_occ(field_id, field, group_id, grp, occ_id, occ, n)  -- PK (field_id, group_id, occ_id)
sum_loc(region, muni, n)   sum_year(year, n)   sum_emp(v, n)   sum_hours(v, n)   sum_day(day, n)
sum_employer(org_id, v, n) -- PK (org_id,v): organization/name variant counts; missing ID stored as ''
employer_catalog(org_id, name_key, v, n) -- PK (org_id,name_key): precomputed representative name and total
legacy_occ_map(legacy_id, tuple, n)      -- complete modern taxonomy candidates and contribution counts
legacy_loc_map(municipality_code, tuple, n) -- municipality/region candidates and contribution counts
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
| `ix_employer_id (employer_id, pub_date)` | Organization filters; covering counts and timeline date reads (D55) |
| `ix_employer_rank (n DESC, v COLLATE NOCASE, v COLLATE BINARY, org_id)` on `employer_catalog` | Indexed unfiltered Top-30 without grouping (D55) |
| `ix_legacy_occ_id (legacy_occ_id)`, `ix_legacy_muni_code (legacy_muni_code)` | Reconcile only ads affected by a legacy-key consensus change (D58) |

`ix_employer` and `ix_employer_id` are created once by `ensureSummary()` in the build worker. They are not built when opening read connections. Startup/activation reports indexing progress; SQLite maintains them on subsequent imports/removals. D55 adds the organization-ID backfill and catalog rebuild below, without re-import.

### Employer identity backfill and catalog (D55)
### Legacy taxonomy and location enrichment (DAT-015/016, D58)

`legacy_occ_map` stores counts for each complete field/group/occupation tuple observed with an occupation legacy ID. `legacy_loc_map` stores counts for each available municipality/region tuple observed with a municipality code. Counts represent successfully imported ads, not import attempts; duplicate ad IDs do not contribute twice. Each named dataset has independent maps and remains offline.

`ensureSummary()` performs a one-time migration in the build worker. It clears partial candidate maps when the completion marker is absent, scans stored `raw` in 500-row transactions to backfill the indexed legacy-key columns and candidate counts, then reconciles all affected keys before setting `legacy_enrichment_version = '1'`. The migration invalidates summary readiness first, so summaries rebuild from the resulting promoted columns. An interrupted scan can safely restart by clearing and rebuilding the candidate maps; `raw` is unchanged.

On import, only newly inserted ads contribute candidates. The worker reconciles both their reference keys and their own legacy keys before committing each batch, so import order does not matter. Existing rows are restored from their source projection in `raw`, then missing taxonomy fields are filled only when one complete tuple remains; municipality and region are resolved independently when each has one candidate. Summary deltas for changed existing rows and final projections for new rows are committed with the batch. Source removal subtracts that source's candidates, deletes its ads, reconciles survivors and updates summaries in the same build-worker transaction. Manual reprocessing rebuilds keys, candidate maps, enriched projections, FTS and summaries from `raw`.

`getAd()` overlays missing taxonomy concept IDs/labels and municipality/region labels from promoted columns onto the parsed source response (D59). Existing source fields, taxonomy arrays and legacy metadata are preserved; stored `raw` is never changed. Ad tags, breadcrumbs and workplace facts therefore match the enrichment used by listings and filters. Geographic codes/concept IDs are not invented.

No live dataset was migrated during T12 verification. Full-scale migration time, disk use and import/removal cost on the 11.25M-ad dataset remain unmeasured.

### Employer identity backfill and catalog (D55)

`open()` adds nullable `employer_id` to legacy databases under a serialized schema lock. Before readiness, `ensureSummary()` migrates `sum_employer` to its composite key and invalidates old summaries; it scans stored JSON in 500-row transactions to fill IDs using current normalization (string/number to trimmed string; blank/other types to NULL). Raw JSON, original employer names, source records, rowids and FTS stay unchanged. Interrupted batches roll back and retry; `employer_identity_version = '1'` is written only after the scan. Summary version 2 is restored after the catalog and all summaries rebuild. This is worker-only background work with existing progress/error notices; no source re-import is needed.

`sum_employer` retains variant counts so deleting a source can remove obsolete labels accurately. `employer_catalog` stores one row per non-empty `org_id` with `name_key = ''`; for missing IDs, `org_id = ''` and `name_key` is the exact employer name. `v` is the binary-minimum remaining variant and `n` is the combined total. Import/removal transactions refresh only affected identities; full rebuild/reprocessing resets and regenerates the catalog. Unfiltered Top-30 reads the ranked catalog directly. Filtered Top-30 counts stored IDs (or exact missing-ID names) and joins catalog labels: no raw-JSON extraction, organization/name mapping build or representative-name aggregation occurs during queries.

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

`employers` defaults to `[]`; new entries are `{id, label}`. String IDs select `ads.employer_id IN (...)`, merging all organization-name variants; `id:null` selects exact names only where `employer_id IS NULL`. Different organization IDs never merge by name. Legacy session strings retain `ads.employer COLLATE BINARY IN (...)` behavior. All predicates are parameterized, OR within employers and AND with other dimensions. Every shared query applies this filter. Top-30 remains statistics over all active filters, not an own-filter-excluded option universe (D55/SRC-020/SRC-022). Session persistence, ad return, Clear all and dataset reset use the existing renderer lifecycle; chips show saved labels and refreshed buttons retain focus by identity.

## Adding a new filter dimension

1. Reuse a suitable stored column when available; otherwise add a column (and index) in `db.js` `SCHEMA` and populate it in `toRow()`/`INSERT_SQL`.
2. Handle it in `where()`. For a regular own-filter-excluded facet, add its definition to `FACETS` and keys to the materialized facet projection (D37). A statistics-driven filter such as `employers` reuses its existing filtered statistics query instead.
3. Add UI in `index.html`/`app.js` and include it in `DEF`, `renderActive()`.
4. If stored columns changed, migrate/backfill or re-import the data (existing rows are skipped by id, so remove the source first). Organization-based employer filtering uses D55's automatic background backfill/catalog migration, not re-import.

## Source data generations (files in `~/storage/ams_data`, checked 2026-10-15)

| Years | Format | `id` | Taxonomy (field/group/occupation) | Location | Other |
|---|---|---|---|---|---|
| 2006 | `.jsonl` | null (synthetic `h-<sha1>`) | Modern labels/concepts are null; `occupation.legacy_ams_taxonomy_id` is `0` on 245,192 of 245,227 ads; field/group legacy IDs are null | `municipality_code` on 242,308 ads; `city` on 157,991; municipality/region labels, concept IDs and coordinates absent | dates `YYYY-MM-DD`; hours present |
| 2007–2016 | `.jsonl` | null (synthetic `h-<sha1>`) | Modern labels/concepts are null; occupation legacy IDs present in most records; field/group legacy IDs absent (T12 full scan) | `municipality_code` present in most records; city is common; municipality/region labels, concepts and coordinates absent (T12 full scan) | dates `YYYY-MM-DD`; hours present |
| 2017 | `.jsonl` | string `0017-nnnnnn` | Modern labels/concepts are null; occupation legacy IDs present; field/group legacy IDs absent (T12 full scan) | `municipality_code` present; city is common; municipality/region labels, concepts and coordinates absent (T12 full scan) | |
| 2018, 2019 | `.json` array (3.5–3.6 GB, one line) | number | present | municipality and region present | dates `YYYY-MM-DD HH:MM:SS,000000000`; `*_municipality_patched.zip` exist (not used) |
| 2020–2022 | `.jsonl` | string | present, objects | municipality in ~52% (2020) to ~98% | |
| 2023–2026 | `.jsonl` | 40-char hash | arrays of objects | present | employment type is an array; first element stored |

The folder also holds `.zip`/`.zst` copies, which the importer does not accept. `publication_date` is cut to its first 10 characters, which works for both date formats.

T12 full-file survey (2026-10-31): against `2026-Q3.jsonl`, 4,038,404 of 4,667,640 ads from 2007–2017 have a unique complete modern field/group/occupation tuple; 4,573,278 of 4,606,062 coded ads map to a unique municipality, and 4,076,347 also map to a unique region hierarchy. 2006 has lower occupation coverage (28 ads) but 240,179 municipality-code matches. Ten municipality codes have conflicting region metadata. T12 promotes indexed legacy keys and enriches missing query/display columns from dataset-local consensus while preserving `raw`; full-scale migration and cost remain unverified. See [T12](tasks.md#t12-legacy-taxonomy-and-geographic-enrichment-dat-015-dat-016) for survey details.
