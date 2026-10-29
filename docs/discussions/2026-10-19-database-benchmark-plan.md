# Database and Ingestion Benchmark Plan

Date: 2026-10-19

Purpose: compare current SQLite behavior with a DuckDB spike using AMS's real app query shapes and import semantics. This is an exploration plan, not a requirement, design decision, or implementation commitment.

## 1. Guardrails and setup

- Use the same machine, OS, storage device, power mode, app build, source file, and test sequence for each engine. Record CPU, RAM, free disk, OS, Node/Electron versions, database/source sizes, and whether the run is first-use or repeat.
- Capture the currently reported symptoms as end-to-end measurements; do not substitute isolated SQL timing for UI latency.
- Do not import, remove sources, reprocess, build indexes, or otherwise write to the user's live 70 GB database for benchmarks. Use fresh disposable databases for ingestion and destructive tests. If a UI test might trigger a pending one-time migration/build, inspect database state read-only first and use a copy or scratch dataset.
- Keep scratch databases on the same real storage class being evaluated; avoid `/tmp` if it is RAM-backed. Ensure enough free space for source, database, index build, and temporary files.
- Do not clear OS caches. Label runs as first-use or warm/repeat; record cache conditions instead of claiming a cold-cache result.
- Enable `AMS_TRACE=1` to capture current `[query]` queue/work timing and IPC trace. Capture wall-clock UI elapsed time separately. Record RSS/peak RSS, CPU, disk activity, and peak temporary/final disk use where available.
- Run each repeatable scenario three times where cost permits. Preserve raw logs and summarize median, min/max, and failures. Agree success thresholds before the comparison; do not infer a win from one favorable query.

## 2. SQLite app baseline: worker and query coverage

First collect one normal startup and one Datasets-page visit. Time splash-to-usable-window, first result page, total count, statistics completion, and Datasets-page first paint independently. Include `info()`/dataset catalog loading, since Datasets currently waits for both responses before rendering.

Exercise every worker lane and its user-facing path:

| Lane | Operations to time |
|---|---|
| `lists` | First-page search, later-page search, relevance search, single-ad `get`, `info` (including Datasets page), `datasetStats` |
| `counts` | Exact total for unfiltered, date-only, and combined filters |
| `facets` | Occupation, location, year, employment, hours, and Top-30 employer counts; time whole response and any cache/repeat behavior |
| `timelines` | Unfiltered, year-only, date-range-only, and fully combined-filter timeline |
| `build` | `ensureSummary` only if measuring a disposable DB's initial summary/index build; `removeSource` and `reprocess` only on disposable databases |

For each request, record queue wait, worker execution, IPC end-to-end, and UI time-to-updated-widget. Record whether result rows appeared before count/statistics finished. A separate-lane request can still compete for CPU, memory bandwidth, storage, and page cache.

## 3. Worst-case query scenarios

Use exact filter values available in the real data. Save each filter object, sort mode, offset, and expected result count so both engines receive identical requests.

1. **Unfiltered landing:** initial page, total, all facet universes, Top-30 employers, and full-range timeline.
2. **Broad search:** no filters; common keyword; rare keyword; one- and two-character prefixes; multi-term AND/OR; relevance sort. Prefix cases matter because broad FTS posting lists can dominate.
3. **Single-year filter:** latest populated year and an older, denser year; include results, count, facets, employer stats, and timeline.
4. **Broad taxonomy:** field-only and group-only selections, with and without a broad date range; capture own-facet-excluded counts.
5. **User-reported combined case:** date range + occupation + employment type + exact employer. Add location and a keyword as separate variants. Include the exact combination reported to hang if reproducible.
6. **Sparse result case:** a rare occupation/employer/date intersection and a query matching zero or one ad. Exact filtered counts and facet universes still need to complete.
7. **Deep paging:** first page, representative middle offset, and deep offset for chronological sort; also test relevance paging separately.
8. **Employer statistics:** unfiltered Top-30, broad filtered Top-30, and exact-employer selected case.
9. **Ad detail:** open ads with short and large raw payloads while statistics are active.

Run isolated requests first to identify the expensive operation. Then run real UI workflows with concurrent list/count/facet/timeline requests. Finally, change filters rapidly through a broad-to-narrow sequence and record active query overlap, worker queues, stale responses, time until current results, and whether obsolete work continues to consume resources. Do not treat dropped UI responses as cancelled database work.

### 3a. User-supplied SQL regression case and access-path diagnosis

Evidence supplied on 2026-10-19, not rerun by the assistant: four sequential raw-`ads` aggregations took **9.854 s unfiltered** (user 1.681 s, system 1.075 s) and **219.412 s filtered** (user 14.137 s, system 50.089 s), about **22.3 times slower**. These are full CLI batch times, not app timings. Cache state and background load are unknown. Follow-up output supplies these individual statement timings:

| Statement | Unfiltered real / user / sys (s) | Filtered real / user / sys (s) |
|---|---|---|
| Year grouping | 1.361205 / 0.371050 / 0.145683 | 120.368900 / 4.522820 / 21.097777 |
| Region/municipality grouping | 7.676700 / 0.652325 / 0.783142 | 50.894080 / 3.515357 / 12.371736 |
| Top-30 employers | 0.778196 / 0.644026 / 0.121996 | Unknown: paste truncated |
| Total count | 0.034562 / 0.011090 / 0.023387 | Unknown: paste truncated |

In that earlier output, year grouping is **88.4x slower**, location grouping **6.63x slower** than the supplied unfiltered run. The filtered year groups are 2026: 22,726; 2025: 35,711; 2024: 35,581; 2023: 58,140; 2022: 67,865; 2021: 52,759; 2020: 24,543. Their sum is **297,325**, **2.64%** of the unfiltered total **11,252,350**. The complete repeat below confirms the filtered count. Earlier years are absent from this intersection, not proven absent from the taxonomy itself. Do not infer missing employer/count timings from the batch remainder or treat truncated output as query failure.

Year and location together took **171.263 s** in the earlier output; if these timings belong to the preceding batch, they explain about **78%** of its wall time. Seven output groups do not imply little input work. Location ran second and may have benefited from cached pages; repeat in isolation and reversed order before attributing differences solely to plans.

A later complete filtered repeat supplied these timings; keep its run identity separate:

| Statement | Repeat real (s) | Repeat user CPU (s) | Repeat system CPU (s) |
|---|---:|---:|---:|
| Year grouping | 20.099536 | 2.983920 | 7.458401 |
| Region/municipality grouping | 18.861146 | 3.104677 | 7.069606 |
| Top-30 employers | 70.715133 | 3.772093 | 13.366012 |
| Total count | 44.399777 | 3.361181 | 10.270521 |

The repeat's statement times sum to **154.075592 s**, not a separately captured process time. Its explicit total is **297,325**, agreeing with its year-group sum. Employer and count timings remain unknown for the earlier truncated run; never splice the repeat into that batch. Year improves about **6.0x**, location **2.7x** between filtered runs, consistent with cache/resource effects but not proof of cache warming or unchanged plans. Preserve both runs; neither has controlled cache conditions.

Revised diagnostic priority: capture plans for all four statements, use count as the simplest predicate/access-path case, and inspect employers as the repeat's largest cost. Employers plus count take about **74.7%** of repeat statement time. The count has no grouping or sorting, so those cannot be the sole explanation for filtered latency. Distinguish predicate-index scans, full scans and table fetches; for year grouping also check an order/group-driven non-covering year-index scan and temporary grouping. Do not assume count and group queries share a plan, or that `LIMIT 30` avoids counting/ranking matching employer groups. Keep year variability in the benchmark even though it is no longer the repeat's largest cost.

Additional correctness baselines: unfiltered year groups include 2099: 2 and 2051: 1; the displayed blank region/municipality group contains 5,045,216 unfiltered ads and 15,619 filtered ads. Preserve future-date exclusion and distinguish NULL from empty strings explicitly in future result capture; CLI blank formatting alone cannot distinguish them. No cleanup or normalization is implied.

Preserve the original workload: `sqlite3 -readonly -header -column`, `.timer on`, and these four statements in order:

```sql
SELECT year, COUNT(*) AS ads
FROM ads
GROUP BY year
ORDER BY year DESC;

SELECT region, muni AS municipality, COUNT(*) AS ads
FROM ads
GROUP BY region, muni
ORDER BY ads DESC;

SELECT employer, COUNT(*) AS ads
FROM ads
WHERE employer IS NOT NULL AND employer <> ''
GROUP BY employer
ORDER BY ads DESC, employer COLLATE NOCASE
LIMIT 30;

SELECT COUNT(*) AS ads FROM ads;
```

For the filtered batch, apply this exact predicate to each statement before grouping (combine with the existing employer predicate using `AND`):

```sql
pub_date <= '2026-10-19'
AND hours = 'Heltid'
AND field_id IN (
	SELECT DISTINCT field_id FROM sum_occ WHERE field = 'Data/IT'
)
```

This is an hours + field + date-upper-bound case, not an employment-type or exact-employer filter. No timeline query is present; retain the separate timeline scenarios. The following are future benchmark steps only; none was performed when recording this evidence:

- Capture each statement's `.timer` output, total process time, result rows/counts and full plans with `EXPLAIN QUERY PLAN` for both batches. Preserve grouping/tie semantics; year/location ties without a secondary key need not have identical row order between engines.
- Record actual live index definitions, existing planner-statistics state, SQLite CLI and Electron SQLite versions, relevant connection settings (cache, mmap, temp storage), database identity/size and background workload. Do not call the app's `open()` helper for read-only inspection: it executes schema/PRAGMA writes. Do not run `ANALYZE`, `PRAGMA optimize`, index creation or reprocessing on the live database.
- Test the access-path hypothesis: identify covering index scans versus non-covering index/table scans, residual predicates, temporary B-trees, and the `sum_occ` subquery plan. Check whether broad index selection causes many table-page fetches. Record page-cache/I/O counters where available, read throughput/latency, CPU and temp-file use; `real - user - sys` is not an I/O-wait measurement.
- Measure predicate selectivity with date-only, hours-only, field-only, pairwise and full combinations. Include a no-date-bound variant diagnostically, but do not treat it as equivalent: the original bound excludes NULL and future dates. Save resolved field IDs and NULL/future-date counts. Keep these potentially expensive reads scheduled, not automatic startup checks.
- Repeat individual statements and original batches, label cache/run order, and alternate batch order where practical without clearing OS caches. This distinguishes one dominant query, repeated table access, cache effects and temporary grouping costs. Check the uncorrelated subquery rather than assuming it runs once per ad.
- Keep exact raw-SQL results separate from app summary-table paths and own-dimension-excluded facets. Then measure the actual app workload with equivalent filter values to see how much additional latency comes from concurrency and queues.
- Compare unchanged SQLite first. If authorized later, evaluate a targeted compound/covering index or narrow analytical projection only on disposable data, documenting added storage, build/import/update cost and query trade-offs. Compare that separately with DuckDB's equivalent workload; neither assume one index solves every grouping nor attribute a plan/schema improvement solely to engine choice.

## 4. Dataset-page delay diagnosis

Time `api.info()`, `api.datasets()` and the full `renderData()` path separately. Repeat with summaries/indexes confirmed ready and with a disposable dataset whose summary build is intentionally pending. Record which call gates first paint. This separates metadata-query cost from main-thread/renderer work and one-time database build/index work.

## 5. Ingestion performance: latest dataset

Use latest available full quarter, expected `~/storage/ams_data/2026-Q3.jsonl` (documented reference: 129,721 ads). Verify exact path, byte size, non-empty line count, and source checksum before runs. If that file is unavailable, use newest complete provider file and record which one.

For each engine, start from a fresh disposable database on the same target storage and include equivalent application semantics: parse provider records, normalize/promote fields, synthesize legacy IDs where applicable (not present in this quarter, but retain behavior in the overall comparison), deduplicate IDs, retain required raw payload, build/update full-text search, and produce equivalent summary/index state.

Measure these phases separately:

- Time to first inserted row and total source-read/import completion.
- Rows/sec, source MB/sec, inserted/skipped/invalid counts, and per-file elapsed time.
- Full-text index creation or maintenance time, summary/facet/timeline/employer-stat build time, and time until app is ready for normal search.
- Peak RSS, CPU time/utilization, disk writes, peak scratch/WAL/temp space, and final database plus index size.
- App progress/worker responsiveness during import, not just command-line completion.

Run a second import of the same file to measure duplicate-only ingest and verify no duplicate ads. Optionally import a second overlapping quarter if available to measure mixed insert/duplicate behavior; this is not required for the initial comparison. Keep a distinct DuckDB native `read_json`/`read_ndjson` bulk-load number only as an ingestion lower bound, not as the apples-to-apples app result. Include FTS maintenance: current DuckDB FTS documentation says index is not automatically refreshed when source rows change, so measure rebuild or the chosen incremental alternative after import.

The latest-quarter test is useful for engine and parser throughput, but only ~1% of the full ad count; do not extrapolate 11M-row load time linearly without a larger scaling test. Index build, transaction size, memory pressure, and storage behavior can change at full scale.

## 6. Correctness and comparison gates

Before comparing speed, compare:

- Inserted ad IDs, unique totals, source counts, and duplicate/error accounting.
- First-page IDs and ordering for chronological/relevance scenarios.
- Exact counts, all facet values/counts with own-dimension exclusion, Top-30 ordering, and timeline bins.
- Swedish diacritics, prefix/phrase, AND/OR, and relevance-search behavior.
- Search immediately after initial import and after duplicate/incremental import; verify FTS reflects newly inserted rows.
- Dataset metadata/chooser statistics and ad-detail raw payload retrieval.

Report any semantic mismatch as a failed comparison, not a performance trade-off hidden in averages.

## 7. Results and decision

Keep one results table per engine and workload with: scenario, run type, end-to-end ms, queue ms, worker ms, rows returned/matched, peak RSS, disk/temp use, and correctness status. Include raw logs, query/filter definitions, source checksum, and environment notes with results.

Decision should weigh the worst user-visible scenarios, not only bulk aggregation or ingest. DuckDB is a candidate only if it improves the slow app workflows without unacceptable first-page/search regressions, FTS maintenance cost, memory/disk demand, or Electron/offline packaging complexity. Import speed is a separate score from interactive query performance.
