# Deployment and cutover runbook

Target platform: Railway. Three services plus object storage.

| Service | Root | Build | Start |
| --- | --- | --- | --- |
| `web` | `apps/web` | `pnpm install --frozen-lockfile && pnpm build` | `pnpm --filter @vigia/web start` |
| `api` | `apps/api` | `pnpm install --frozen-lockfile && pnpm build` | `pnpm --filter @vigia/api start` |
| `postgres` | Railway add-on | managed | managed |

`next start` reads `PORT` from the environment. The API reads `PORT` too
(default 3001). Set `NODE_ENV=production`; the config rejects the default
session secret, the default administrator password and the default database URL
in production.

## Environment

### API

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` on Railway. |
| `VIGIA_AUTH_SECRET` | yes | Random string of at least 32 characters; signs sessions. Changing it signs everyone out. |
| `VIGIA_ADMIN_EMAIL` | yes | First administrator, created only while the `users` table is empty. |
| `VIGIA_ADMIN_PASSWORD` | yes | Non-default; change it from the app after the first sign-in by creating a new admin. |
| `VIGIA_ADMIN_NAME` | no | Display name of the first administrator. |
| `VIGIA_SESSION_HOURS` | no | Session length, 12 by default. |
| `VIGIA_DATABASE_URL` | yes | Railway PostgreSQL connection string (target). |
| `VIGIA_DATABASE_SSL` | yes | `true` for Railway. |
| `VIGIA_DATA_DIR` | no | Local raw-artifact directory until R2 is provisioned. |
| `VIGIA_CORS_ORIGINS` | no | Web origin; the Next proxy avoids browser CORS. |
| `DEEPSEEK_API_KEY` | no | Without it the explain endpoint uses the deterministic template. |

### Web

| Variable | Required | Notes |
| --- | --- | --- |
| `VIGIA_API_URL` | yes | Public API origin, e.g. `https://vigia-api.up.railway.app`. |
| `PORT` | no | Railway injects it. |

### Release command

```bash
pnpm migration:run
```

Run it once per deploy, before starting the API. Migrations are idempotent.

Uploads created before flexible datasets need their column roles and generic
rows once:

```bash
pnpm --filter @vigia/api backfill:generic
```

It is idempotent: uploads that already have roles are skipped.

## Backfill from an external legacy database

The Python implementation is no longer in this repository, but a legacy
deployment may still hold the original data. The backfill reads its `uploads`
rows, each normalized Parquet file and its `quality.json`, then writes the
metadata, canonical rows and quality issues into the target. It preserves upload
ids, is idempotent by file hash and does not copy raw upload bytes (the audit copy
stays in the legacy object store).

```bash
# Legacy source, target schema.
VIGIA_DATABASE_URL=postgresql://legacy... \
VIGIA_TS_DATABASE_URL=postgresql://target... \
pnpm --filter @vigia/api backfill -- --dry-run

VIGIA_DATABASE_URL=postgresql://legacy... \
VIGIA_TS_DATABASE_URL=postgresql://target... \
pnpm --filter @vigia/api backfill
```

`VIGIA_TS_DATABASE_URL` is only needed when the target differs from
`VIGIA_DATABASE_URL`; the runtime API reads the former first.

### Verify

```sql
SELECT count(*) FROM "uploads";
SELECT count(*) FROM "surveillance_cases";
SELECT count(*) FROM "upload_quality_issues";
```

Then compare the API responses with the frozen fixtures for the same uploads,
signed in as an administrator:

```bash
TOKEN=$(curl -s https://api.example/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.org","password":"…"}' | jq -r .token)
curl -H "Authorization: Bearer $TOKEN" https://api.example/api/uploads
curl -H "Authorization: Bearer $TOKEN" https://api.example/api/analysis/series
curl -H "Authorization: Bearer $TOKEN" https://api.example/api/forecast
curl -H "Authorization: Bearer $TOKEN" https://api.example/api/explain
```

The demo fixture must produce `model_id 28a9c197d91b9a33`. The parity suite is
the authority:

```bash
pnpm --filter @vigia/api test:db
```

The suite drops and recreates its own database: `VIGIA_TEST_DATABASE_URL`, or
`VIGIA_DATABASE_URL` with a `_test` suffix. It refuses any name that does not
end in `_test`, so it never touches the application database.

## Cutover

1. Freeze writes on the external legacy service. Reads can continue.
2. Run `pnpm migration:run` against the target.
3. Run the backfill dry-run, the real backfill and `backfill:generic`.
4. Verify counts, the demo model id and the API responses.
5. Point `VIGIA_API_URL` on the `web` service to the Nest API and redeploy.
6. Keep the legacy service read-only for one observation window and compare
   weekly series, anomalies, forecast scorecards and explanations per upload id.
7. Decommission the external legacy service and its database after a backup.

The model registry is versioned, so a difference is traceable to a data cut or a
config change.

## Rollback

Rollback is a URL switch, not a data restore:

1. Set `VIGIA_API_URL` back to the external legacy service.
2. Leave the target database in place; the backfill is idempotent and can be
   re-run after a fix.
3. A failed backfill transaction rolls back as a unit; no partial upload remains.

## Performance gate

The storage decision requires validating PostgreSQL analytical queries with a
~2M-row upload before retiring a second analytical engine:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT department, year, epi_week, SUM(cases)
FROM surveillance_cases
WHERE upload_id = $1
GROUP BY department, year, epi_week
ORDER BY department, year, epi_week;
```

The composite indices in the initial migration cover these reads. If the budget
is exceeded, add weekly materialized aggregates behind the same repository
interface; the API contract does not change.

## Object storage

The storage port currently has a traversal-safe local adapter. Raw uploads must
move to Cloudflare R2 before the legacy audit store is retired, so upload audit
does not depend on a container filesystem. The `StoragePort` boundary is already
in place; only a new adapter and the deployment configuration are missing.
