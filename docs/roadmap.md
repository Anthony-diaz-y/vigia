# Roadmap

Durable state of the project. Read this first after a pause; it is the source of
truth, not the chat transcript or memory.

## Locked decisions

| Topic | Decision |
| --- | --- |
| Product | Turn messy surveillance exports into validated datasets, charts and 1-4 week forecasts with measured accuracy. Decision support, never a medical device. |
| First disease | Dengue. Multi-disease is designed in the schema, not trained. |
| Granularity | Department and province in the first cut. District is explicitly out. |
| Storage | PostgreSQL as system of record, DuckDB ephemeral per worker job as the analytical engine, object storage for raw uploads. |
| Deployment | Railway. Access by invitation at launch. |
| Language | Code, comments, commits and docs in English. |

## Out of scope

Anemia and other diseases, district-level series, nominal patient records,
clinical recommendations, multi-tenant billing, real-time ingest.

Anemia is excluded on purpose: ENDES is a survey with a ~3-year cadence and SIEN
holds facility records, so there is no reliable weekly series to forecast. It is
a separate classification or annual-trend product.

## Invariants

- `rows_in == rows_valid + rows_dropped + duplicates_collapsed` in every quality report.
- Only `CANONICAL_COLUMNS` are persisted. A personal-data column cannot reach the
  normalized dataset even when the PII denylist misses it.
- Idempotent by file hash: the same bytes always produce the same output paths.
- The epidemiological week (`year`, `epi_week`) is the time unit, never the month.
- A forecast is published only for units that beat the seasonal baseline in
  backtest; otherwise the API returns `insufficient_evidence`.

## Milestones

### M1 - Ingestion and data contract (done)

Readers with encoding/delimiter detection and `dtype=str`, macro and legacy
format rejection, YAML alias mapping with fuzzy fallback, PII rejection,
normalization to the canonical contract, deduplication, per-upload quality
report, idempotent Parquet plus `quality.json`.

Done when: contract suite is green. Status: 10 tests, green.

### M2 - Deterministic analysis (done)

- Weekly series per department and province, built from the M1 Parquet.
- Interannual comparison by epidemiological week.
- Department x week heatmap and ranking by rate per 100k inhabitants.
- Anomaly flags from a robust z-score on the seasonally adjusted residual.
- DuckDB as the query engine over tenant Parquet.

Done when: the module produces the same aggregates as a hand-checked SQL query
and every figure is reproducible from a fixed dataset cut. No LLM involved.

### M3 - Forecast with evidence (done)

- Horizon 1-4 weeks, quantiles p10/p50/p90.
- Rolling-origin backtest, minimum three windows, per geographic unit.
- MASE against `SeasonalNaive(52)` and WIS for the intervals.
- The last 4-6 epidemiological weeks are flagged provisional (reporting delay)
  and excluded from training.
- Model registry: artifact, data cut, config and metrics, all versioned.

Done when: the scorecard per department exists and the publication gate works.

### M4 - Explanation and recommendations (done)

- SHAP top-5 drivers per geographic unit.
- Deterministic action table mapping driver to preventive action. The LLM writes
  prose, never decisions.
- Optional DeepSeek narrative over an aggregated payload only; deterministic
  template fallback when the API is unavailable.

### M5 - API and web UI (done)

- Upload, mapping review, quality report, dashboard, export.
- FastAPI plus React, PostgreSQL metadata, invitation-only access.
- Fixed disclaimer: support tool, not a medical device, does not replace the
  health authority.

## Open decisions

- Commit policy for non-code docs.
- Whether the UI reads DuckDB directly from the API or always through the worker.
- Object storage provider account (Cloudflare R2 chosen, not provisioned yet).

## How to resume

```bash
cd C:/workSpace/proyectos/vigia
git log --oneline
uv sync
uv run pytest
```
