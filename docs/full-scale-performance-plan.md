# Full-scale performance plan

Date: 2026-10-15. Priority: reduced (T6). Startup, the main-process freeze and the first-page path were fixed by D22 (window shown in about 3 s on 11 million ads, database reads only in workers, unfiltered total from per-source counts); sections 2 and the main-thread part of 5 are therefore largely done. The remaining work is about filtered counts, facets, the timeline, cold-cache queries and deep paging, to be picked up when filtered use at full scale feels slow.

**Requirements**: NFR-003, NFR-004, NFR-005.

## Goal and recommendation

Restore responsive browsing with the full dataset (reported as about 70 GB and 11 million ads). Prioritize database queries, aggregation strategy and storage layout over a Rust rewrite or database migration.

SQLite already executes queries in native C. Rewriting the application in Rust would not eliminate the same SQL scans, sorts or disk I/O. Keep Electron and SQLite initially; reconsider only after measurements identify a limitation that targeted optimization cannot resolve.

This is a proposed investigation and implementation sequence, not an adopted schema or architecture decision. Record major decisions with requirement IDs before implementing them. Current observations come from read-only code inspection, not profiling the full database. Another instance was actively changing the application during inspection; recheck the current implementation before starting.

## 1. Establish a measured baseline

- Separate time to a responsive window, first result page, filtered results, exact total, facets, timeline and single-ad detail.
- Measure first-run and repeated-query behavior on the full dataset. Record hardware, storage, RAM, database size and import activity; do not clear shared system caches.
- Include unfiltered browsing, common and rare search terms, broad prefixes, occupation/location/date combinations, relevance sorting and deep paging.
- Capture query timings and `EXPLAIN QUERY PLAN`; identify scans, temporary sorts, table lookups and index use. Inspect planner statistics and FTS index health before tuning.
- Measure main/renderer event-loop stalls, worker queue delays and disk pressure separately. A responsive window and a fast query are different outcomes.
- Retain NFR-003's existing 130k-ad targets. Agree measurable full-scale latency targets before claiming NFR-005 is complete.

## 2. Remove broad scans from startup

- Inspect the combined `SELECT MIN(pub_date), MAX(pub_date) FROM ads` used by `info()` and the timeline. This query shape can scan the date index despite the index existing.
- Compare separate indexed endpoint lookups with persisted import-maintained metadata. Preserve empty-database and null-date behavior.
- Use valid per-source totals rather than recounting all ads during normal startup.
- Show the usable window and first results without waiting for optional counts, facets or charts.

## 3. Reduce facet, count and timeline work

- Profile the five facet groupings, exact filtered total and timeline individually. Avoid repeated equivalent work.
- Persist unfiltered summaries and option lists where useful; invalidate or update them after import and source removal. The inspected unfiltered facet cache is memory-only.
- Evaluate query-specific covering/composite indexes, including employment and working-hours access paths. Measure read gains against index size and import cost; do not add every possible index.
- Evaluate bounded filter-result caching and targeted aggregate tables. Summary dimensions must support exact filter semantics; one enormous cross-product table is not the default solution.
- Preserve own-dimension exclusion in facet counts, zero-count options and existing search/filter semantics.
- Let results appear independently of slower statistics. Any change to count accuracy or live-update behavior needs requirement review and user confirmation.

## 4. Shrink the interactive working set

- Benchmark a compact metadata table separated from full ad JSON. Currently `raw` is stored alongside list/filter columns; large records can increase I/O for non-covering queries.
- Fetch the full payload only when opening an ad. Both metadata and payload can remain in SQLite.
- Compare representative query latency and database/index size before committing to a layout change.
- Provide a migration or documented re-import plan; record the decision and update the data model.

## 5. Bound interactive work

- Keep synchronous database work off the Electron main process. Separate short result/detail requests from expensive statistics.
- Inspect cancellation behavior: the observed queue supersedes queued requests, but an already-running obsolete query continues.
- Investigate a supported interruption or worker-replacement strategy for obsolete reads, with explicit error handling and safe handling of writes.
- Retain stale-response protection. Bound queues and prioritize current requests; more workers can worsen shared disk/cache contention.

## 6. Replace deep OFFSET paging

- Benchmark keyset pagination using a stable date/rowid cursor for chronological order.
- Preserve tie handling, navigation and filter resets. Relevance ordering needs its own stable pagination strategy; do not apply the chronological cursor blindly.
- Treat this as a scrolling optimization, not a fix for startup or facet scans.

## 7. Reassess language and engine only with evidence

| Option | When to consider |
|---|---|
| SQLite | First choice for local indexed browsing and FTS; optimize and measure it first. |
| DuckDB | Benchmark if broad analytical aggregations remain dominant; not an automatic replacement for interactive FTS. |
| Dedicated search engine | Evaluate if exact arbitrary filtered facets and relevance search remain too slow; include index size, offline packaging and maintenance costs. |
| Rust component or rewrite | Consider for demonstrated CPU-heavy parsing/indexing or runtime-footprint needs, not as a remedy for expensive SQL. |

## Completion evidence

- Record before/after timings for the same full-scale scenarios, distinguishing first-run and repeated runs.
- Verify a responsive window while expensive queries execute and obsolete requests do not accumulate.
- Verify exact totals, facets, timeline, chronological/relevance results and paging against reference queries.
- Verify import/source-removal invalidation and any migration on disposable data before using the real database.
- Update requirement status, affected architecture/data-model/constraints docs, decisions and developer notes. State any unverified behavior; do not promise a speedup without measurements.
