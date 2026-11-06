# M10 - TypeScript and PostgreSQL migration

Strangler migration from Python/FastAPI/React-Vite/DuckDB to
TypeScript/Next.js/NestJS/PostgreSQL/TypeORM. PostgreSQL becomes the system of
record and the analytical engine; DuckDB and Parquet leave the runtime. The
product, API contract, scientific invariants and Spanish UI copy stay unchanged.

Decision record: `docs/adr/0001-postgres-system-of-record.md`.

## Specs

- S1 (ADR 0001): PostgreSQL is the single system of record for metadata,
  quality, canonical rows and model registry.
- S2 (ADR 0001): PostgreSQL is the analytical engine; DuckDB/Parquet are
  retired. Parquet remains an export format only.
- S3: No phase is complete until its TypeScript implementation matches the
  committed snapshots in `contract/snapshots`.
- S4: The Python implementation remains deployed and is the oracle until the
  corresponding TypeScript module passes parity.
- S5: API compatibility is mandatory: paths, payload shape, status strings,
  issue codes, headers and error semantics are frozen.
- S6: Each phase lands on its own branch with tests and a green build.
- S7: The screaming-modular boundaries are preserved: ingestion -> analysis ->
  forecasting -> explanation, with a shared epidemiology kernel.
- S8: Code quality gates: no dead code, no duplicated constants, migrations
  instead of `create_all`, parameterized SQL, explicit validation at the
  boundary.

## Phases

### Phase 0 - Contract baseline (done)

- Fix test isolation so the suite never reads the developer's `.env` database.
- Generate golden snapshots from the Python oracle (`contract/snapshots`).
- Guard snapshots with a test that regenerates and compares bytes.
- Make the forecast data cut use source upload hashes instead of derived
  Parquet bytes.
- Record ADR 0001 and this task.

Branch: `feat/ts-m0-contract-baseline`.

### Phase 1 - PostgreSQL foundation (done)

- pnpm workspace, `apps/api`, `packages/epidemiology`, `packages/contracts`.
- NestJS skeleton: zod-validated config, health, token guard, FastAPI-shaped
  exception filter, helmet and CORS allow-list.
- TypeORM entities and initial migration for uploads, quality issues,
  surveillance cases and model registry, with `timestamptz`, JSONB, natural-key
  uniqueness and analytical indices.
- Storage port with a traversal-safe local adapter; relative keys instead of
  absolute paths.
- `GET /api/uploads`, `GET /api/uploads/:id/quality` and `DELETE /api/uploads`
  read the new schema.
- Integration tests against a real PostgreSQL plus a `docker/init` script for
  `vigia_test` and `vigia_ts`.
- CI runs Python contract tests, TypeScript build/typecheck/lint/format, unit
  tests and PostgreSQL integration tests.

Branch: `feat/ts-m1-postgres-foundation`.

### Phase 2 - Ingestion (next)

- CSV/XLSX readers, mapping, normalization, quality, dedup and idempotency.
- Transactional write of upload + rows + quality.
- Parity with `ingest_*.json`.

### Phase 3 - Analysis

- SQL over `surveillance_cases`: series, interannual, heatmap, ranking,
  anomalies.
- Parity with `analysis_synthetic_*.json` and `api_*.json`.

### Phase 4 - Forecast and explanation

- Seasonal drift, rolling backtest, MASE/WIS, publication gate, model registry.
- Ridge + linear SHAP, action table, narrative fallback.
- Parity with `forecast_synthetic.json` and `explain_synthetic.json`.

### Phase 5 - Web

- Next.js App Router + Tailwind, design tokens, five modules, mapping review.
- Playwright on the critical flows.

### Phase 6 - Cutover

- Backfill existing uploads, feature flags, dual-run, Railway deploy,
  decommission FastAPI.

## Log

- L1: User chose route A from the assessment: PostgreSQL as system of record,
  no DuckDB. Each phase in its own branch, with tests and cleanup.
- L2: Phase 0 implemented. `tests/test_api.py` no longer depends on a local
  PostgreSQL. `tools/contract_snapshots.py` writes 25 snapshots from
  LF-normalized fixtures; 60 Python tests green. Forecast registry now keys the
  data cut by source upload hashes so model ids stay stable across pyarrow
  versions.
- L3: Phase 1 implemented. `pnpm build/typecheck/lint/test` green; 15 TypeScript
  unit tests and 7 PostgreSQL integration tests. The target schema lives in
  `vigia_ts` during the strangler period to avoid colliding with the legacy
  `vigia.public.uploads`; `vigia_test` is the integration database. CI covers
  both stacks.
