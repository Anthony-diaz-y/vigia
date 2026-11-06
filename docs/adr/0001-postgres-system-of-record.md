# ADR 0001 - PostgreSQL as system of record, DuckDB retired

- Status: Accepted
- Date: 2026-11-06
- Supersedes: the DuckDB/Parquet analytical-storage part of the M2 locked decision

## Context

Vigia currently runs a Python/FastAPI backend, a React/Vite dashboard and an
analytical layer built on DuckDB over per-upload Parquet files. Metadata lives
in SQLite by default or PostgreSQL when `VIGIA_DATABASE_URL` is set.

The team maintains TypeScript, Next.js, NestJS, Tailwind, PostgreSQL and
TypeORM. The Python data stack (pandas, numpy, DuckDB, pyarrow) is the part the
team cannot own comfortably, and the migration must not change the product's
behavior or its scientific invariants.

The documented target was "PostgreSQL as system of record, DuckDB ephemeral per
worker job as the analytical engine, object storage for raw uploads". That
design duplicates storage (Parquet for analysis, PostgreSQL for metadata) and
keeps a second query engine in the critical path.

## Decision

1. **PostgreSQL is the single system of record** for upload metadata, quality
   reports, canonical surveillance rows, model registry metadata and, later,
   access control.
2. **PostgreSQL is also the analytical engine** for the current scale: weekly
   series, interannual comparisons, heatmaps, rankings and anomaly inputs are
   SQL queries over `surveillance_cases`. No ORM in hot analytical paths.
3. **DuckDB and Parquet are retired from the runtime.** Parquet remains
   available only as an export format; raw uploads stay in object storage (local
   disk until Cloudflare R2 is provisioned) for audit and idempotency.
4. **The migration is a strangler migration.** The Python service remains the
   oracle until each TypeScript module matches the committed contract snapshots.
   No Python module is deleted before its port passes parity.
5. **Target stack:** Next.js + Tailwind for the UI, NestJS + TypeORM for the
   API and persistence, TypeScript for the domain and numerical code.

## Schema consequences

- `uploads` keeps one row per accepted file, unique by `file_hash`, with stable
  storage keys instead of absolute filesystem paths.
- `surveillance_cases` stores only `CANONICAL_COLUMNS`, plus `upload_id` and a
  deterministic `natural_key` for the deduplication key. The unique index is
  `(upload_id, natural_key)`.
- Indices: `(upload_id, department, year, epi_week)`,
  `(upload_id, province, year, epi_week)` and `(upload_id, ubigeo)`.
- `upload_quality_issues` normalizes the quality report so it can be queried
  without parsing JSON; the original quality JSON remains a downloadable
  artifact.
- `model_registry` stores `model_id`, config, data cut and metrics as JSONB.
- Timestamps are `timestamptz` in UTC. The API continues to serialize ISO-8601.
- Schema changes use TypeORM migrations; `synchronize` is disabled outside tests.

## Consequences

Positive:

- One database to operate, back up and reason about.
- The team can own the full stack without pandas/DuckDB knowledge.
- Transactional ingestion: an upload and its rows commit or roll back together.
- Idempotency and scoping become constraints, not filesystem conventions.
- Analytical SQL is portable and inspectable; no second engine to tune.

Negative:

- PostgreSQL analytical performance must be validated with a 2M-row upload.
  Mitigation: benchmark in CI, composite indices and, if needed, weekly
  materialized aggregates. DuckDB can return behind a port if the budget is
  exceeded, without changing the API.
- Raw uploads still need object storage for audit; local disk is a temporary
  adapter.
- The migration needs a parity harness and a dual-run period.

## Invariants preserved

- `rows_in == rows_valid + rows_dropped + duplicates_collapsed`.
- Only `CANONICAL_COLUMNS` are persisted.
- PII is rejected before storage.
- The same bytes produce the same upload identity and the same rows.
- The epidemiological week is the time unit.
- A forecast is published only when it beats the seasonal baseline (`MASE < 1`).
- The LLM writes prose, never decisions.
- The disclaimer is present on every surface.

## Migration phases

0. Contract snapshots and ADR.
1. Next.js/Tailwind UI against the current API.
2. NestJS + TypeORM + PostgreSQL metadata, auth and uploads catalog.
3. TypeScript analysis over PostgreSQL.
4. TypeScript forecast and explanation.
5. TypeScript ingestion writing PostgreSQL.
6. Cutover, backfill, CI, decommission Python.

Each phase has its own branch, tests and a parity gate.
