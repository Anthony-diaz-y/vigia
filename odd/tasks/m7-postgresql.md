# M7 - PostgreSQL system of record

Swaps the metadata database from SQLite to PostgreSQL, per the locked storage
decision and the M5 S4 deferral. The database URL becomes configurable so the
same metadata models run on either engine; SQLite stays the default for dev and
tests.

## Specs

- S1 (locked): "Storage | PostgreSQL as system of record, DuckDB ephemeral per worker job as the analytical engine, object storage for raw uploads."
- S2 (M5 S4): "Metadata on SQLite now, PostgreSQL later (decision L2): swap the driver at M5 finalization."
- S3: The database URL is read from `VIGIA_DATABASE_URL`; when unset it defaults to the current SQLite file, so dev and tests are unchanged.
- S4: `build_engine` applies SQLite-specific connect args (`check_same_thread=False`) only for SQLite URLs; PostgreSQL URLs need none.
- S5: The same metadata models work on both engines; the existing SQLite-backed suite stays green.

## Tasks

- T1 (S1): Add `psycopg[binary]` dependency (SQLAlchemy 2.x Postgres driver). Route: inline. Commit: 286fe1b.
- T2 (S3): `Settings.from_env` reads `VIGIA_DATABASE_URL`, defaulting to the SQLite file. Route: inline. Commit: 286fe1b.
- T3 (S4): `build_engine` applies `check_same_thread=False` only for sqlite URLs. Route: inline. Commit: 286fe1b.
- T4 (S4, S5): Test engine construction for sqlite vs postgresql URLs, plus a smoke test against a real Docker Postgres. Route: inline. Commit: 286fe1b.
- T5: Docs (README, roadmap M7). Route: inline. Commit: 286fe1b.

## Log

- L1: "aplica el push, y comieza con lo siguiente pendiente"
- L2: Decisions: use psycopg3 (psycopg[binary]) as the driver; launch Docker Desktop from here to validate against a real Postgres.
- L3: Implemented and committed as 286fe1b on feat/m7-postgresql (chained on feat/m6-mapping-review). psycopg 3.3.7 installed. 55 tests green, including a skip-guarded smoke test against a Docker Postgres (postgres:16-alpine, container vigia-pg, port 55432).
