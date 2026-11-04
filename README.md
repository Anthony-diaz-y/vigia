# vigia

*Vigia*: the lookout that raises the alarm before the outbreak lands. The name
comes from *vigilancia epidemiologica*, the practice this tool supports.

Ingestion, analysis and short-term forecasting for Peruvian public health
surveillance data (dengue first, multi-disease by design).

The project turns a messy surveillance export (`.csv` / `.xlsx`) into a validated
canonical dataset, interactive charts and a short-horizon forecast with measured
accuracy. It is a decision-support tool, not a medical device, and it never
substitutes the official health authority.

## Scope of the first slice

`M1` — ingestion and data contract. Everything else depends on this being correct.

- Robust reading of `.csv` / `.xlsx` (encoding, delimiter, header variants).
- Column mapping via a declarative per-source config plus fuzzy fallback.
- Canonical normalization, deduplication and a per-upload quality report.
- Idempotent by file hash.
- Personal-data columns are rejected before storage.

Out of scope: other diseases, district-level series, nominal patient records,
clinical recommendations, multi-tenant billing, real-time ingest.

## Layout

```
config/mappings/     Per-source column mapping and PII rules (YAML)
docs/roadmap.md      Durable state: decisions, milestones, resume steps
src/vigia/           Python package
  ingest/            Readers, mapping, normalization, quality, pipeline
  analysis/          DuckDB series, comparison, heatmap/ranking, anomalies
  forecast/          Seasonal-drift forecast, backtest, scorecard, registry
  explain/           SHAP drivers, action table, narrative
  api/               FastAPI app, metadata (SQLite/PostgreSQL), token auth
web/                 React (Vite) dashboard
tests/               Contract tests, synthetic fixtures
```

Persistence target for the full product: PostgreSQL as the system of record,
DuckDB as the per-job analytical engine, object storage for raw uploads.
`M1` writes normalized Parquet plus a quality report; it needs no database.

## Development

```bash
uv sync
uv run pytest
```

## Run

```bash
# API plus the built dashboard on http://localhost:8000
uv run uvicorn vigia.api.main:app --reload

# Build the dashboard first (or run it in dev mode with hot reload)
cd web && npm install && npm run build      # FastAPI then serves web/dist
cd web && npm run dev                       # dev server on :5173, proxies /api
```

Access is token-gated: set `VIGIA_ACCESS_TOKEN` (default `vigia-dev`) and pass
it as the `X-Access-Token` header or in the UI token field.

Uploads go through a mapping review step: before ingestion, the dashboard shows
how source columns map to canonical columns and you can confirm or correct the
assignment. Once several files are uploaded, the file selector in the header
scopes every chart, scorecard and forecast to the file you pick (`upload_id`
on the API), or to all of them at once.

Metadata storage defaults to SQLite. Set `VIGIA_DATABASE_URL` to a
`postgresql+psycopg://user:pass@host:port/db` URL to run it on PostgreSQL.

Copy `.env.example` to `.env` to set the token and database URL without typing
them on every launch (`.env` is gitignored).

## Data sources

- MINSA / CDC Peru open data: dengue, malaria, acute respiratory infections.
- INS / SIEN: nutritional status and anemia records.
- SENAMHI and ENFEN/IMARPE: climate and El Nino context.

Uploads are expected to be aggregated counts by geography, epidemiological week
and case classification. Nominal patient records are out of contract.
