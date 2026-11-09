# vigia

*Vigia*: the lookout that raises the alarm before the outbreak lands. The name
comes from *vigilancia epidemiologica*, the practice this tool supports.

Ingestion, analysis and short-term forecasting for Peruvian public health
surveillance data (dengue first, multi-disease by design). The project turns a
messy surveillance export (`.csv` / `.xlsx`) into a validated canonical dataset,
interactive charts and a short-horizon forecast with measured accuracy. It is a
decision-support tool, not a medical device, and it never substitutes the
official health authority.

## Stack

TypeScript end to end:

- **Web:** Next.js 16 App Router, React 19, Tailwind 4, Recharts.
- **API:** NestJS 12, TypeORM, PostgreSQL 16.
- **Domain:** `packages/contracts` (zod schemas) and `packages/epidemiology`
  (canonical contract, ingestion kernel, analysis, forecast, explanation).
- **Persistence:** PostgreSQL is the system of record and the analytical engine.
  Parquet is an export format only.

## Layout

```
apps/api/            NestJS API: ingestion, analysis, forecast, explain, export
apps/api/config/     Per-source column mapping and PII rules (YAML)
apps/web/            Next.js App Router + Tailwind dashboard
packages/contracts/  Shared zod request/response contracts
packages/epidemiology/ Canonical contract and numerical kernels
docker/              PostgreSQL bootstrap for local development and tests
DEPLOYMENT.md        Railway, backfill, cutover and rollback
```

Golden request/response fixtures used by the PostgreSQL e2e suite live in
`apps/api/test/snapshots`; upload fixtures live in `apps/api/test/fixtures`.

## Quick start

```bash
pnpm install
docker compose up -d
pnpm migration:run
pnpm dev
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001/api
- Next rewrites `/api/*` to `VIGIA_API_URL` (default `http://localhost:3001`).

Copy `.env.example` to `.env` to set the access token, database URLs and the
Next.js API origin. Access is token-gated: pass `X-Access-Token` or the token
field in the UI (default `vigia-dev`).

## Commands

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test                    # unit tests
pnpm --filter @vigia/api test:db   # PostgreSQL e2e (needs vigia_test)
pnpm --filter @vigia/api backfill  # legacy database -> target (cutover)
```

## API

- `POST /api/upload` and `POST /api/upload/preview` — ingest or preview a file
  with the mapping review step.
- `GET /api/uploads`, `GET /api/uploads/:id/quality`, `DELETE /api/uploads` —
  upload catalog and quality report.
- `GET /api/analysis/{series,interannual,heatmap,ranking,anomalies}` —
  parameterized SQL aggregates over `surveillance_cases`.
- `GET /api/forecast` — seasonal drift, rolling backtest, MASE/WIS and the
  publication gate; versioned in `model_registry`.
- `GET /api/explain` — ridge + linear SHAP drivers, deterministic actions and a
  template narrative (DeepSeek is optional).
- `GET /api/export?format=csv|parquet` — canonical rows from PostgreSQL.

Every read accepts `upload_id` to scope the response to one upload; omitted, it
aggregates all uploads.

## Invariants

- `rows_in == rows_valid + rows_dropped + duplicates_collapsed`.
- Only `CANONICAL_COLUMNS` are persisted; personal-data columns are rejected.
- The same bytes produce the same upload identity (SHA-256 idempotency).
- The epidemiological week is the time unit.
- A forecast is published only when it beats the seasonal baseline (`MASE < 1`).
- The LLM writes prose, never decisions.
- The disclaimer is present on every surface.

## Deployment

Railway services, environment variables, backfill, dual-run, rollback and the
2M-row performance gate: `DEPLOYMENT.md`.

## Data sources

- MINSA / CDC Peru open data: dengue, malaria, acute respiratory infections.
- INS / SIEN: nutritional status and anemia records.
- SENAMHI and ENFEN/IMARPE: climate and El Nino context.

Uploads are aggregated counts by geography, epidemiological week and case
classification. Nominal patient records are out of contract.
