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

## Database schema (`ads.db`, WAL mode)

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
```

### Indexes

| Index | Purpose |
|---|---|
| `ix_pub (pub_date)`, `ix_year (year)` | Date sort/range, year facet |
| `ix_occ_cov (field_id, group_id, occ_id, field, grp, occ)` | Occupation filter + covering facet scan |
| `ix_group`, `ix_occ` | Direct group/occupation filters |
| `ix_loc_cov (region, muni)` | Location filter + facet scan |
| `ix_source (source)` | Removing a source |

## Filter object (renderer ↔ main)

```js
{ q, terms, sel, loc, from, to, emp, hours, sort }
```

`terms` is an array of committed free-text entries and `q` the text still being typed; the main process joins them and the FTS query ANDs all tokens. `sel` is an array of `{ k: 'field'|'group'|'occ', id, label, fi, gi }` (occupation selections) and `loc` an array of `{ k: 'region'|'muni', id, label, ri }` (location selections); each list is OR-combined.
Dates are `YYYY-MM-DD` strings compared lexicographically. `sort` is `newest | oldest | relevance`.

## Adding a new filter dimension

1. Add a column (and index) in `db.js` `SCHEMA` and populate it in `toRow()`/`INSERT_SQL`.
2. Handle it in `where()` and add a facet query in `facets()`.
3. Add UI in `index.html`/`app.js` and include it in `DEF`, `renderActive()`.
4. Re-import the data (existing rows are skipped by id, so remove the source first).
