# Exploration Discussion (2026-10-19)

## Scope

Pure exploration chat. No implementation or requirements changes. Record discussion contents here.

## Transcript

**User:** "This is a pure exploration chat, no implementation or requirements should be written down, however the contents/transcript of the discussion should be written down in a file within docs/discussions. Ok?"

**Assistant:** "I’ll treat this as exploration only: no implementation or requirements changes. I’ll check project notes and the caveman-mode instructions, then keep a discussion record under `docs/discussions` as we go."

### SQLite vs DuckDB

**User:** "The system is currently using sqlite to store the data (both pure ads, but also statistics lookups, etc.). From the beginning I guess it was selected without knowing the actual size of the data. Fully populated it's around 11.3 million records (~70GB of data). All data is supplied as json/jsonl from provider.

Searching around it appears as though duckdb would be a better option for this type of data, where fast filtering and a lot of statistics calculations are to be made on the fly, as well as enriching old data with new data. Apparently it even has built-in support for ingress of jsonl as well as enriching old data.

The app is not yet released, so breaking changes in regard to database type etc. is fine, as I am the only one who needs to re-import data.

Is changing to duckdb a viable option and if so, how large of a job would that be?"

**Assistant:**

Yes, viable. Not automatic upgrade, and not clearly a better fit for every current workload.

Current evidence: live dataset is 11.25M ads / 70.4 GB SQLite. Existing app already gets startup around 0.6 s, first filtered page around 5 ms in one measured scenario, and cached queries around 1–2 ms. Broad first-use facets remain slow at roughly 6–7 s. SQLite is currently doing indexed, selective browsing well; DuckDB’s likely advantage is broad analytical aggregation. Need same-data benchmarks to know whether net gain exists.

Main risks:

- DuckDB’s JSON readers handle NDJSON and JSON arrays, but they do not replace AMS-specific parsing: synthetic IDs for old ads without IDs, schema differences by year, pruning, duplicate policy, and per-record error accounting still need explicit logic. “Enriching” means designing SQL joins/merge rules; it is not automatic data reconciliation.
- DuckDB has an FTS extension with BM25 and Swedish stemmer support, but its docs warn that the index does not update automatically as source rows change. AMS imports incrementally update FTS today. Rebuilding the full search index after each import may be too expensive; incremental search-index maintenance or another search design is a gate.
- AMS has five read-worker lanes plus an import worker, each opening the same SQLite dataset. DuckDB is designed around one process owning read/write access; its docs advise against multiple instances in the same process attaching the same file. Worker ownership/concurrency likely needs redesign, not a driver swap.
- SQLite’s B-tree indexes support selective filters, date ordering and fast first-page queries. DuckDB’s ART indexes target point/highly selective lookups and must fit in memory during index creation; columnar scans/zonemaps may favor aggregates but could regress list browsing. Benchmark exact app queries.
- DuckDB’s Node client and native platform binaries exist, but Electron packaging and offline distribution need a proof. Its FTS extension normally installs from an extension repository; offline app would need a pinned, locally bundled compatible extension.
- Disk size is unknown. DuckDB compression may reduce stored columns, but JSON and search indexes may offset savings. Keep generous free space for fresh import and index build; do not assume database will shrink.

Effort estimate for one developer: 1–3 days for a decision-grade spike; roughly 2–4 weeks for a robust backend replacement, re-import path, tests, packaging and full-scale verification. Full 11M import/rebuild runs add wall-clock time; estimate could expand if FTS or native packaging is troublesome. Renderer should need limited changes if existing IPC contracts stay stable.

Recommended next step: spike on representative input. Prove Node API works in packaged Electron, load FTS offline, verify Swedish/prefix/phrase/relevance behavior and incremental import, then compare exact current queries (first-page filters, totals, broad facets, timeline, employer stats) on same data while measuring latency, RAM and disk. Decide only from those results. No full implementation or requirements changes in this exploration.

References: [DuckDB JSON loading](https://duckdb.org/docs/current/data/json/loading_json.html), [DuckDB Node client](https://duckdb.org/docs/current/clients/node_neo/overview.html), [DuckDB concurrency](https://duckdb.org/docs/current/connect/concurrency.html), [DuckDB FTS extension](https://duckdb.org/docs/current/core_extensions/full_text_search.html), [DuckDB indexes](https://duckdb.org/docs/current/sql/indexes.html), [DuckDB extension distribution](https://duckdb.org/docs/current/extensions/extension_distribution.html).

### Correction: app-level latency

**User:** "The note of 'Broad first-use facets remain slow at roughly 6–7 s.' does not really match the actual time within the app itself. Broad searches take multiple minutes to complete, focusing in on a single year takes at least a minute, and focusing on a fairly narrow filtering using both timespan, occupation, employment and employer basically hangs the statistics summary calculations as well as causing the rendering of the dataset page to take several secons (if not more)."

**Assistant:**

Agreed. The 6–7 s figure describes selected isolated facet-query measurements, not representative app-visible latency. It must not be used as the user’s end-to-end experience or to minimize the reported problem. User reports: broad searches take minutes; a single-year filter takes at least a minute; combined date/occupation/employment/employer filters can stall statistics and delay the Datasets page by seconds or more.

Code-path context, not a root-cause diagnosis: each filter refresh requests count, facets and timeline in separate worker lanes. Queued same-type requests can be superseded, but an already-running query continues; concurrent database work can contend. The Datasets renderer awaits `api.info()` and `api.datasets()` before writing its page. `info()` uses compact summary tables when built, but queries min/max from `ads` when summaries are not built. These are plausible sources of delay and need timing evidence to confirm.

Correction to recommendation: treat reported app-level latency as the actual decision baseline. DuckDB becomes more worth benchmarking, but is not yet proven to fix it; measure end-to-end UI latency and per-query/queue timings on the same filters before comparing engines. The prior 1–3 day spike and 2–4 week replacement estimates remain rough and may be optimistic if investigating the existing contention path or reproducing severe stalls adds scope.

### Benchmark plan

**User:** "outline a plan separate to the discussion for how to perform this test with all timeline workers / queries using worst-case scenario queries, as well as a performance test of data ingestion, since importing all data from files currently take 1hr+ (the latter does not have to import all data, using the latest dataset would be sufficient for performance testing)"

**Assistant:** Created a separate [database and ingestion benchmark plan](2026-10-19-database-benchmark-plan.md). It covers all five database worker lanes, worst-case and user-reported filter combinations, overlapping query/UI latency, Datasets first-paint diagnosis, and apples-to-apples latest-quarter import with full-text/statistics build costs, duplicate re-import, resource use, and correctness checks. The documented latest sample is `2026-Q3.jsonl` (~129,721 ads); workspace search did not find it, so plan assumes the external `~/storage/ams_data` copy and requires verifying file path/checksum before execution. No code or requirements changed.

### Manual full-size SQLite measurements

**User (summary):** Manually ran two four-query batches with `time sqlite3 -readonly -header -column "$DB"` and `.timer on` against the full-size database. Both group ads by year and by region/municipality, calculate Top-30 non-empty employers, and count all matching ads. The second batch applies the same predicate to every query:

```sql
WHERE pub_date <= '2026-10-19'
	AND hours = 'Heltid'
	AND field_id IN (
		SELECT DISTINCT field_id FROM sum_occ WHERE field = 'Data/IT'
	)
```

The employer query additionally excludes NULL/empty employers. Year groups sort by year descending; location groups by count descending; employers by count descending then `employer COLLATE NOCASE`, limited to 30. Requested reasoning and discussion/plan updates only; no implementation or tests.

| Batch | Real | User CPU | System CPU |
|---|---:|---:|---:|
| Unfiltered | 9.854 s | 1.681 s | 1.075 s |
| Filtered | 219.412 s | 14.137 s | 50.089 s |

**Assistant:**

The filtered batch takes about 22.3 times longer. These are totals for four statements plus CLI/output overhead, not individual query times or UI latency. Per-statement `.timer` output, result counts, query plans, cache conditions and concurrent machine activity were not supplied. No measurements were rerun.

This is important evidence: severe latency can occur outside Electron and its worker queues. Renderer/IPC overhead is therefore not a necessary explanation for the reported slowdown, although app concurrency or other machine activity could still worsen it. It does not establish that all four queries are slow, or that the CLI and app execute identical plans.

The leading hypothesis is an access-path change, not that SQLite must process fewer rows faster. The declared schema has narrow indexes for year, region/municipality, publication date, taxonomy, hours, and employer/date, but no index covering this entire predicate and all aggregation outputs. Unfiltered year/location grouping can scan covering indexes; the employer index can supply employer values, and unfiltered `COUNT(*)` can scan a narrow index without fetching full table rows. Filtering can lose those advantages. SQLite generally chooses one index per table occurrence for these AND predicates rather than intersecting every separate index. It may scan a broad date/hours/taxonomy index and fetch many table rows to check remaining predicates or retrieve group keys. Against a large table storing raw JSON, this can touch far more pages than a compact index scan, even with fewer final matches. An alternative is a wide table scan or expensive temporary grouping/sorting. The live schema and actual plans have not been inspected, so none of these paths is confirmed.

The wall-clock/CPU gap and 50.089 s of system CPU make storage/page-cache activity a strong investigation target, but do not prove random I/O or identify the bottleneck. Scheduling, other processes, filesystem behavior and temporary-file spills remain possible contributors. Only per-statement plans and resource measurements can distinguish them.

The date upper bound may match most dated ads, but selectivity is unknown; it excludes NULL and later dates, including possible erroneous future dates. Likewise, `Heltid` may be common and Data/IT still span many rows. The uncorrelated `IN (SELECT DISTINCT ...)` must not be blamed as a per-ad subquery without plan evidence. `hours` is working hours, not employment type; this is a distinct case from the previously reported employment/employer combination.

These raw-table queries also differ from the app's unfiltered summary-table fast paths and own-dimension-excluded facet counts. Keep them as an exact SQL regression workload, alongside actual app queries, rather than substituting one for the other.

The result strengthens the case for benchmarking DuckDB's columnar filtering/aggregation, but does not prove migration is necessary or sufficient. A better SQLite plan, covering index or narrow analytical projection might address much of the gap; those alternatives need measured costs for disk, ingestion and maintenance. Compare unchanged SQLite first, then any explicitly scoped SQLite tuning on disposable data, then equivalent DuckDB queries. The benchmark plan now captures this case and the evidence needed to distinguish those explanations. Only discussion documents changed; no database access, tests, code, requirements or design decisions changed.

### Follow-up: individual statement timings

**User (summary):** Supplied full unfiltered output and truncated filtered output from the preceding SQL batches. The filtered paste includes complete year/location results and their timings, but ends after four employer rows, before employer timing and the total-count result.

| Statement | Unfiltered real / user / sys (s) | Filtered real / user / sys (s) | Real-time ratio |
|---|---|---|---:|
| Ads per year | 1.361205 / 0.371050 / 0.145683 | 120.368900 / 4.522820 / 21.097777 | 88.4x |
| Ads per region/municipality | 7.676700 / 0.652325 / 0.783142 | 50.894080 / 3.515357 / 12.371736 | 6.63x |
| Top-30 employers | 0.778196 / 0.644026 / 0.121996 | Not supplied | Unknown |
| Total ads | 0.034562 / 0.011090 / 0.023387 | Not supplied | Unknown |

**Assistant:**

The slowdown is now localized to at least two statements. Year grouping alone takes 120.369 s and is the largest measured filtered cost; year plus location total 171.263 s. If these are the same executions as the reported 219.412 s batch, they account for about 78% of its wall time. Do not assign the remaining time to employers or count individually: both timings are missing. The truncated paste does not establish query failure or corrupted database contents.

The seven filtered year groups sum to **297,325 ads**, about **2.64%** of the unfiltered **11,252,350**. This is final intersection selectivity, not evidence that SQLite examined only 297,325 rows or that any individual predicate is selective. The filtered years are 2020-2026 only. Preserve this as a correctness baseline; do not infer whether earlier years lack matching hours, taxonomy, dates or some combination without further evidence.

Returning seven year groups cannot itself explain two minutes of output/rendering overhead. Input scanning, table-page access, predicate evaluation and any intermediate grouping remain the targets. One specific plan hypothesis is that SQLite chooses a year-index scan to preserve grouping/order, losing covering access when it must read date/hours/field from the table. Another is a date/hours/field-driven scan with residual filtering and temporary grouping. Comparing the two year-query plans is the cheapest future discriminator; no plan has been obtained here. Small final group count does not rule out sorting many input records into those groups.

Location was second in each batch and may benefit from pages fetched by year grouping; its shorter filtered time does not prove a better plan. Repeats and reversed/isolated statement order must separate query cost from cache effects. The very fast unfiltered count is consistent with a narrow-index count path, not proof that filtered counting will be fast.

The unfiltered output also confirms two ads grouped under 2099 and one under 2051, and a blank region/municipality group containing 5,045,216 ads (15,619 in the filtered output). Preserve these values in cross-engine correctness checks. CLI blank cells do not distinguish NULL from empty strings, so do not merge or normalize such groups silently. These observations do not authorize data cleanup.

Plan updated to prioritize year aggregation, preserve the supplied timings and result baselines, and leave missing filtered employer/count timings explicitly unknown. No queries, tests, implementation, requirements or design-decision changes.

### Follow-up: complete filtered repeat

**User (summary):** Supplied a new, complete run of the same filtered batch, including employer and total-count timings.

| Statement | Repeat real (s) | Repeat user CPU (s) | Repeat system CPU (s) | Earlier filtered real (s) |
|---|---:|---:|---:|---:|
| Ads per year | 20.099536 | 2.983920 | 7.458401 | 120.368900 |
| Ads per region/municipality | 18.861146 | 3.104677 | 7.069606 | 50.894080 |
| Top-30 employers | 70.715133 | 3.772093 | 13.366012 | Not supplied |
| Total ads | 44.399777 | 3.361181 | 10.270521 | Not supplied |

**Assistant:**

The four statement times sum to **154.075592 s** (about **2 min 34 s**), not a separately measured process wall time. Keep this repeat separate from the earlier 219.412 s process measurement; do not fill the earlier missing timings with new values. The explicit filtered count is **297,325**, agreeing with the sum of the seven year groups. The repeat preserves those year counts and the displayed leading location counts. No automated full-result comparison was performed.

The largest measured cost in this repeat is now **employer aggregation (70.715 s)**, followed by **count (44.400 s)**. Together they consume about **74.7%** of summed statement time. The earlier priority on year aggregation alone was provisional and is superseded by examining all four plans, with particular attention to count as the simplest query and employers as this repeat's largest cost. `LIMIT 30` limits returned employer groups, not the matching ads that must be counted and ranked.

The slow count is a useful discriminator: it has neither `GROUP BY` nor `ORDER BY`, so aggregation sorting cannot explain the whole filtered slowdown. Candidate selection, residual predicate checks, table/index access and the field-ID subquery remain relevant even without grouping. Count being slower than year/location grouping in the same batch does not mean counting is inherently more expensive; their chosen access paths or changing cache/resource conditions can differ. Actual plans are still missing.

Year grouping improved about **6.0x** and location about **2.7x** from the earlier filtered output, while remaining far from interactive. This is consistent with cache warming or reduced contention, not proof of either. We have not established identical plans, connection settings or background activity. A repeated execution is not a controlled warm-cache measurement, and the large remaining wall/CPU gaps are not direct I/O-wait measurements. Preserve first-observed and repeat timings separately rather than reporting only the better run.

The benchmark plan now retains both runs, uses the confirmed count as a correctness gate, and prioritizes count/employer plan comparisons while retaining the year query's large variability. No database access, tests, implementation, requirements or design-decision changes.
