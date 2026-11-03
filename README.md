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

Out of scope for now: forecasting, dashboards, API, authentication, other
diseases, district-level granularity.

## Layout

```
config/mappings/     Per-source column mapping and PII rules (YAML)
src/vigia/     Python package
  ingest/            Readers, mapping, normalization, quality, pipeline
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

## Data sources

- MINSA / CDC Peru open data: dengue, malaria, acute respiratory infections.
- INS / SIEN: nutritional status and anemia records.
- SENAMHI and ENFEN/IMARPE: climate and El Nino context.

Uploads are expected to be aggregated counts by geography, epidemiological week
and case classification. Nominal patient records are out of contract.
