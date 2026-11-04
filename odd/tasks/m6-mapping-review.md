# M6 - Mapping review

Completes the "mapping review" step of M5 S1. Before ingestion, the user sees how
source columns map to canonical columns and can correct the mapping. Auto-mapping
stays the default; a confirmed mapping is authoritative.

## Specs

- S1 (M5): "Upload, mapping review, quality report, dashboard, export."
- S2: A preview step shows, for a chosen file and before any ingestion: the
  source columns in order, the auto-mapping (canonical -> source header), the
  unmapped source columns, the missing required columns and any PII matches.
- S3: The user can reassign any canonical column to any source column. The
  confirmed mapping is authoritative: ingestion uses exactly the canonical ->
  source assignments the user confirmed.
- S4: PII rejection is unchanged: a personal-data column rejects the upload
  before any storage.
- S5: Existing behavior is preserved: demo load, upload without review, export
  and every dashboard endpoint keep working (47 tests stay green).

## Tasks

- T1 (S2, S4): Add `POST /upload/preview` returning the mapping preview without ingesting. Route: inline. Commit: 0ae60a8.
- T2 (S3): Extend `POST /upload` to accept a mapping override and treat it as authoritative (wire the existing `mapping_override`). Route: inline. Commit: 0ae60a8.
- T3 (S2, S3): Client `preview` + `upload(file, mapping)` in web/src/api.js. Route: inline. Commit: 0ae60a8.
- T4 (S2, S3): Mapping review UI in web/src/App.jsx (preview table, reassignment dropdowns, confirm). Route: inline. Commit: 0ae60a8.
- T5 (S5): Contract tests for preview/override/PII + docs (README, roadmap). Route: inline. Commit: 0ae60a8.

## Log

- L1: "gneial ahora si comencemos con las implementaciones faltantes, revisa que implementaciones faltan y cuando temrines empezaremos a mejorar el diseño y más cosas"
- L2: Review found the M5 S1 "mapping review" step unimplemented. Decisions: features first, then productionize; PostgreSQL via local Docker; Cloudflare R2 and Railway not provisioned yet (blocked). Backend already supports `mapping_override` in `ingest_file` but it is dead code, never wired to the API.
- L3: Implemented and committed as 0ae60a8 on feat/m6-mapping-review. 53 tests green (6 new: preview contract, missing required, PII detection, authoritative override, missing-required rejection, age-less upload). web/ build green. Also fixed a pre-existing crash in `_age_group` when an upload has no age column (`np.select` received nullable booleans).
