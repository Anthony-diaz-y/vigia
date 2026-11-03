# M2 - Deterministic analysis

Deterministic aggregation, interannual comparison, heatmap/ranking and anomaly
detection over the M1 canonical Parquet, with DuckDB as the query engine. No
LLM involved.

## Specs

- S1: "Weekly series per department and province, built from the M1 Parquet."
- S2: "Interannual comparison by epidemiological week."
- S3: "Department x week heatmap and ranking by rate per 100k inhabitants."
- S4: "Anomaly flags from a robust z-score on the seasonally adjusted residual."
- S5: "DuckDB as the query engine over tenant Parquet."
- S6: Population denominator is injectable (decision L2): the analysis API
  receives population as a parameter (department/province + inhabitants).
  Tests use a synthetic fixture; no real population data is bundled in M2.
- S7: "the module produces the same aggregates as a hand-checked SQL query and
  every figure is reproducible from a fixed dataset cut. No LLM involved."

## Tasks

- T1 (S5): DuckDB engine that reads one or more tenant Parquet files. Route: inline. Commit: 8ceb02f.
- T2 (S1): Weekly series per department and province. Route: inline. Commit: 8ceb02f.
- T3 (S2): Interannual comparison by epidemiological week. Route: inline. Commit: 8ceb02f.
- T4 (S3, S6): Department x week heatmap and ranking by rate per 100k with
  injectable population. Route: inline. Commit: 8ceb02f.
- T5 (S4): Anomaly flags from a robust z-score on the seasonally adjusted
  residual. Route: inline. Commit: 8ceb02f.
- T6 (S7): Contract tests (hand-checked SQL equality, reproducibility).
  Route: inline. Commit: 8ceb02f.

## Log

- L1: "leé docs/roadmap.md y seguí con M2"
- L2: Population decision: user chose "Población inyectable" — the module
  receives population as a parameter (ubigeo/department/province + habitants);
  tests with synthetic fixture; no real data packaged now.
- L3: committed as 8ceb02f on feat/m2-deterministic-analysis ("feat(analysis):
  deterministic aggregates, comparison, ranking and anomalies over M1 Parquet").
  README.md layout (analysis/) updated in the working tree but left uncommitted;
  docs/roadmap.md remains untracked per the open commit-policy decision.
