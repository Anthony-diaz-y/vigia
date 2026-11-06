# Contract snapshots

Golden outputs produced by the current Python implementation. They are the
oracle for the TypeScript/PostgreSQL migration: a port is not done until it
matches these snapshots (exactly for counts, within a documented tolerance for
floating-point statistics).

## Generate

```bash
uv run python -m tools.contract_snapshots
```

`tests/test_contract_snapshots.py` regenerates them in a temporary directory and
fails if any committed file drifts. Regenerate only when a behavior change is
intentional, and review the diff as part of the same commit.

## What is covered

| File | Contract |
| --- | --- |
| `ingest_demo.json`, `ingest_clean.json`, `ingest_synthetic.json` | Canonical rows, quality report, mapping, counters and file hash |
| `analysis_synthetic_*.json` | Weekly series, interannual pivot, heatmap and anomalies |
| `forecast_synthetic.json` | Model id, data cut, scorecard and published quantiles |
| `explain_synthetic.json` | Drivers, actions and deterministic narratives |
| `api_*.json` | HTTP payloads for health, preview, uploads, quality, analysis, forecast, explain |
| `export_demo.csv` | CSV export bytes |

## Rules

- `created_at` is replaced with `<timestamp>`; it is not part of the contract.
- Fixtures are normalized to LF before ingestion, so file hashes and snapshots
  do not depend on the checkout's line-ending configuration.
- The forecast `data_cut.file_hashes` uses the source upload SHA-256, not the
  derived Parquet bytes, so the model id is stable across pyarrow versions.
- Do not hand-edit a snapshot. Change the Python behavior, regenerate, and
  explain the change in the commit.
- Keep these files until the TypeScript implementation passes parity and the
  Python service is retired.
