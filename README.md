# vigia

*Vigia*: the lookout that raises the alarm before the outbreak lands. The name
comes from *vigilancia epidemiologica*, the practice this tool supports.

Ingestion, analysis and short-term forecasting for Peruvian public health
data: dengue, anemia, hospital discharges or any other health dataset. There are
no mandatory columns: each column gets a role (date, place, category, measure…)
suggested by rules and, optionally, by DeepSeek, and confirmed by the user. The
project turns a messy export (`.csv` / `.xlsx`) into an adaptive dashboard with
plain-language findings, alerts, anomalies and a short-horizon forecast with
measured accuracy. It is a
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
apps/api/            NestJS API: ingestion, analysis, forecast, explain,
                     recommendations, export
apps/api/config/     Per-source column mapping and PII rules (YAML)
apps/api/src/cli/    Migrations and backfills run with tsx
apps/web/            Next.js App Router + Tailwind dashboard
packages/contracts/  Shared zod request/response contracts
packages/epidemiology/ Canonical contract and numerical kernels
docker/              PostgreSQL bootstrap for local development and tests
DEPLOYMENT.md        Railway, backfill, cutover and rollback
```

Golden request/response fixtures used by the PostgreSQL e2e suite live in
`apps/api/test/snapshots`; upload fixtures live in `apps/api/test/fixtures`.
API structure and conventions: `apps/api/README.md`.

## Quick start

```bash
pnpm install
cp .env.example .env     # then replace every change-me value
docker compose up -d
pnpm migration:run
pnpm dev
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001/api
- Next rewrites `/api/*` to `VIGIA_API_URL` (default `http://localhost:3001`).

`.env` holds the only credentials: the PostgreSQL user, password and database
that docker compose creates, the same values in `VIGIA_DATABASE_URL`, the
session secret and the first administrator. `VIGIA_DATABASE_URL` is required.
`VIGIA_ADMIN_PASSWORD` has no default: the API refuses to start without it while
the `users` table is empty (migrations and backfills do not need it).
Optional settings and their defaults: `PORT` (3001), `VIGIA_SESSION_HOURS` (12),
`VIGIA_CORS_ORIGINS` (`http://localhost:3000,http://localhost:5173`),
`VIGIA_DATA_DIR` (`data`), `VIGIA_DATABASE_SSL` (false), `DEEPSEEK_API_KEY`.
Postgres listens on `localhost:55432` and holds a single database.

### Access

Everyone signs in with an email and a password. On its first start the API
creates the administrator from `VIGIA_ADMIN_EMAIL` / `VIGIA_ADMIN_PASSWORD`
(email default: `admin@vigia.local`; the password has no default). The administrator
creates the other accounts on the **Usuarios** page.

| Role | Can |
| --- | --- |
| Analista | Upload files and see every page. |
| Administrador | Also create and delete users and delete all data. |

Sessions are HMAC-signed tokens (`VIGIA_AUTH_SECRET`) that expire after
`VIGIA_SESSION_HOURS` (12 by default) and stop working as soon as the user is
deleted. Five failed sign-ins in a row lock that email, from that client IP, for
15 minutes (behind a proxy without `trust proxy` every client shares the proxy
IP, so the lock applies to the email). The counter lives in memory: it resets
on restart and is per API instance. Deleting the last administrator is refused,
even when two administrators delete each other at the same time.
Passwords are stored as scrypt hashes.

## Commands

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test                    # unit tests
pnpm --filter @vigia/api test:db   # PostgreSQL e2e in a throwaway <db>_test database
pnpm --filter @vigia/api backfill  # legacy database -> target (cutover)
```

## API

- `POST /api/auth/login`, `GET /api/auth/me` — sign in and read the session.
  `GET|POST /api/users`, `DELETE /api/users/:id` — accounts (administrators).
  Every other endpoint except `/api/health` needs `Authorization: Bearer`.
- `POST /api/upload` and `POST /api/upload/preview` — ingest or preview a file
  with the column review step. The preview lists the file's real columns with
  samples; when `DEEPSEEK_API_KEY` is set, DeepSeek names each column in Spanish
  and suggests its role (validated server-side, editable by the user). Personal
  data (DNI, names) is accepted but never stored nor sent to the AI. Dates
  become MMWR epi weeks.
- `GET /api/dashboard?upload_id&indicator&year` — dashboard built from the
  file's column roles (only the widgets its data supports) plus `insights`:
  trend, year-over-year change, peak, concentration and dominant categories,
  written from the numbers without an LLM; `GET
  /api/uploads/:id/years` for the year filter; `GET /api/forecast/indicator` —
  seasonal forecast of the chosen indicator (week or month), published only if
  MASE < 1.
- Analysis, forecast, recommendations and explanation endpoints accept
  `indicator`; for non-dengue topics their wording is neutral and, with
  `DEEPSEEK_API_KEY`, alert actions are AI suggestions marked as such.
- `pnpm --filter @vigia/api backfill:generic` fills column roles and generic
  rows for uploads created before flexible datasets.
- `GET /api/uploads`, `GET /api/uploads/:id/quality`, `DELETE /api/uploads` —
  upload catalog and quality report; deleting is for administrators.
- `GET /api/analysis/{series,interannual,heatmap,ranking,anomalies}` —
  parameterized SQL aggregates over `surveillance_cases`.
- `GET /api/forecast` — seasonal drift, rolling backtest, MASE/WIS and the
  publication gate; versioned in `model_registry`.
- `GET /api/explain` — ridge + linear SHAP drivers, deterministic actions and a
  template narrative (DeepSeek is optional).
- `GET /api/recommendations` — department traffic light (alto / medio / bajo),
  plain-language reasons and fixed actions built from the series, anomalies,
  forecast and drivers, a five-year outlook of annual cases (damped trend with
  an 80 % range; incomplete years are estimated from the seasonal shape), and a
  short summary written by DeepSeek (template fallback without a key).
- `GET /api/export?format=csv|parquet` — canonical rows from PostgreSQL.

Every read accepts `upload_id` to scope the response to one upload; omitted, it
aggregates all uploads.

## Invariants

- `rows_in == rows_valid + rows_dropped + duplicates_collapsed`.
- Personal-data columns are forced to _identifier_: never stored, never sent
  to the AI.
- Every endpoint except health needs a signed, unexpired session of an
  existing user.
- The same bytes produce the same upload identity (SHA-256 idempotency).
- With weekly data the year is the epidemiological year on every page.
- A forecast is published only when it beats the seasonal baseline (`MASE < 1`).
- The LLM writes prose, never decisions: alert levels and actions come from
  fixed rules and the action table; DeepSeek only rewords the summary.
- The disclaimer is present on every surface.

## Deployment

Railway services, environment variables, backfill, dual-run, rollback and the
2M-row performance gate: `DEPLOYMENT.md`.

## Data sources

- MINSA / CDC Peru open data: dengue, malaria, acute respiratory infections.
- INS / SIEN: nutritional status and anemia records.
- SENAMHI and ENFEN/IMARPE: climate and El Nino context.

Uploads can be aggregated counts or line lists; nominal identifiers are
dropped at ingestion. Column roles are suggested by rules and, when available,
by the AI; every column with useful information is used. A file can have
several **Cantidad** columns (summed: casos, casos_2024, atenciones…; the first
one is the row weight) and **Valor medido** columns (averaged: edad,
porcentajes). Only constants, extra dates, free text and record codes are left
as **No usar**. Alerts by place (Recomendaciones, Análisis, Explicación)
need dates or epidemiological weeks; monthly or yearly files get the dashboard,
its findings and the indicator forecast.
