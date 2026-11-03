# M5 - API and web UI

FastAPI backend over SQLite metadata plus a React (Vite) single-page dashboard
with upload, quality report, charts, forecast, explanation and export. Access
is token-gated and the UI carries the fixed medical disclaimer.

## Specs

- S1: "Upload, mapping review, quality report, dashboard, export."
- S2: "FastAPI plus React, PostgreSQL metadata, invitation-only access."
- S3: "Fixed disclaimer: support tool, not a medical device, does not replace the
  health authority."
- S4: Metadata on SQLite now, PostgreSQL later (decision L2): swap the driver at
  M5 finalization.
- S5: React SPA with Vite (decision L2): FastAPI serves the API and, when built,
  the SPA static assets.
- S6: Token-based access (decision L2): a configurable access token, no OAuth.

## Tasks

- T1 (S2, S4, S6): SQLite metadata layer (SQLAlchemy), FastAPI skeleton, auth. Route: inline. Commit: 9f7d751.
- T2 (S1): Upload plus quality endpoints. Route: inline. Commit: 9f7d751.
- T3 (S1): Dashboard endpoints: series, interannual, heatmap, ranking, anomalies. Route: inline. Commit: 9f7d751.
- T4 (S1): Forecast and explanation endpoints. Route: inline. Commit: 9f7d751.
- T5 (S1): Export endpoint. Route: inline. Commit: 9f7d751.
- T6 (S1, S5, S3): React (Vite) SPA: upload, dashboard, disclaimer. Route: inline. Commit: 247d973.
- T7: Demo data seed plus contract tests plus docs. Route: inline. Commit: 9f7d751.

## Log

- L1: "continua para poder ver el sistema"
- L2: Decisions: SQLite now / PostgreSQL later; React SPA (Vite); simple access
  token. New dependencies authorized by these choices plus the locked "FastAPI
  plus React" milestone.
- L3: committed as 9f7d751 (api) and 247d973 (web) on
  feat/m5-api-and-web-ui, chained on the M4 branch. 44 tests green. Run with
  ``uv run uvicorn vigia.api.main:app --reload`` (after ``npm run build`` in
  web/) and load the demo dataset from the dashboard. README.md and
  docs/roadmap.md updated in the working tree but left uncommitted.
