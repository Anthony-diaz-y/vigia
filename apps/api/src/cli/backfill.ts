import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { CANONICAL_COLUMNS, KEY_COLUMNS } from '@vigia/epidemiology'
import { parquetReadObjects, type AsyncBuffer } from 'hyparquet'
import { Client } from 'pg'

import { loadEnvFiles, normalizeDatabaseUrl } from '../common/config/app-config'

interface LegacyUpload {
  id: number
  file_hash: string
  filename: string
  source: string
  status: string
  rows_in: number
  rows_valid: number
  rows_dropped: number
  duplicates_collapsed: number
  normalized_path: string
  quality_path: string
  created_at: Date
}

interface LegacyIssue {
  code: string
  message: string
  count: number
  sample: string[]
}

interface LegacyQualityReport {
  rows_in: number
  rows_valid: number
  rows_dropped: number
  duplicates_collapsed: number
  mapped_columns: Record<string, string>
  unmapped_columns: string[]
  issues: LegacyIssue[]
  source_format: string
  encoding: string | null
  delimiter: string | null
  file_hash: string
}

interface CanonicalRow {
  disease: string
  ubigeo: string
  year: number
  epi_week: number
  department: string
  province: string
  district: string
  directorate: string
  sex: string
  age_group: string
  age_type: string
  diagnosis: string
  diagnosis_type: string
  cases: number
}

const CASE_COLUMNS = ['upload_id', ...CANONICAL_COLUMNS, 'natural_key'] as const
const CHUNK_SIZE = 500

// Copia las cargas del esquema Python heredado al esquema TypeScript, omitiendo las ya copiadas
async function main(): Promise<void> {
  loadEnvFiles()
  const dryRun = process.argv.includes('--dry-run')
  const legacyUrl = normalizeDatabaseUrl(process.env.VIGIA_DATABASE_URL ?? '')
  const targetUrl = normalizeDatabaseUrl(process.env.VIGIA_TS_DATABASE_URL ?? '')

  if (!legacyUrl.startsWith('postgres')) {
    throw new Error('VIGIA_DATABASE_URL must point to the legacy PostgreSQL database')
  }
  if (!targetUrl.startsWith('postgres')) {
    throw new Error('VIGIA_TS_DATABASE_URL must point to the target PostgreSQL database')
  }
  if (legacyUrl === targetUrl) {
    throw new Error('legacy and target database URLs are the same')
  }

  const legacy = new Client({ connectionString: legacyUrl })
  const target = new Client({ connectionString: targetUrl })
  await legacy.connect()
  await target.connect()

  try {
    const uploads = await legacy.query<LegacyUpload>(
      `SELECT "id", "file_hash", "filename", "source", "status", "rows_in",
              "rows_valid", "rows_dropped", "duplicates_collapsed",
              "normalized_path", "quality_path", "created_at"
       FROM "uploads" ORDER BY "id"`,
    )

    console.log(`${dryRun ? '[dry-run] ' : ''}found ${uploads.rowCount ?? 0} legacy upload(s)`)
    let copied = 0
    let skipped = 0

    for (const upload of uploads.rows) {
      const existing = await target.query<{ id: number }>(
        'SELECT "id" FROM "uploads" WHERE "file_hash" = $1',
        [upload.file_hash],
      )
      if ((existing.rowCount ?? 0) > 0) {
        skipped += 1
        console.log(`skip ${upload.id} (${upload.filename}): already present`)
        continue
      }

      const quality = await readQuality(upload.quality_path)
      if (quality.file_hash !== upload.file_hash) {
        throw new Error(
          `quality hash mismatch for upload ${upload.id}: ${quality.file_hash} != ${upload.file_hash}`,
        )
      }
      const rows = await readParquet(upload.normalized_path)
      if (rows.length !== upload.rows_valid) {
        throw new Error(
          `row count mismatch for upload ${upload.id}: parquet ${rows.length} != rows_valid ${upload.rows_valid}`,
        )
      }

      if (dryRun) {
        console.log(
          `[dry-run] copy ${upload.id} (${upload.filename}): ${rows.length} rows, ${quality.issues.length} issue(s)`,
        )
        copied += 1
        continue
      }

      await target.query('BEGIN')
      let targetId = 0
      try {
        targetId = await insertUpload(target, upload, quality)
        await insertCases(target, targetId, rows)
        await insertIssues(target, targetId, quality.issues)
        await target.query('COMMIT')
      } catch (error) {
        await target.query('ROLLBACK')
        throw error
      }
      copied += 1
      console.log(
        `copy ${upload.id} -> ${targetId} (${upload.filename}): ${rows.length} rows, ${quality.issues.length} issue(s)`,
      )
    }

    if (!dryRun) {
      await resetUploadSequence(target)
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}done: ${copied} copied, ${skipped} skipped`)
  } finally {
    await legacy.end()
    await target.end()
  }
}

// Lee y parsea el quality.json heredado de una carga
async function readQuality(path: string): Promise<LegacyQualityReport> {
  const text = await readFile(path, 'utf8')
  return JSON.parse(text) as LegacyQualityReport
}

// Lee el Parquet normalizado y lo convierte en filas canónicas
async function readParquet(path: string): Promise<CanonicalRow[]> {
  const buffer = await readFile(path)
  const file: AsyncBuffer = {
    byteLength: buffer.byteLength,
    slice: (start, end) => {
      const view = buffer.subarray(start, end ?? buffer.byteLength)
      return new Uint8Array(view).buffer
    },
  }
  const rows = await parquetReadObjects({ file })
  return rows.map((row) => canonicalRow(row as Record<string, unknown>))
}

// Inserta la carga en el destino conservando su id si está libre y devuelve el id final
async function insertUpload(
  target: Client,
  upload: LegacyUpload,
  quality: LegacyQualityReport,
): Promise<number> {
  const idConflict = await target.query<{ id: number }>(
    'SELECT "id" FROM "uploads" WHERE "id" = $1',
    [upload.id],
  )
  const preserveId = (idConflict.rowCount ?? 0) === 0
  const columns = [
    ...(preserveId ? ['id'] : []),
    'file_hash',
    'filename',
    'source',
    'status',
    'rows_in',
    'rows_valid',
    'rows_dropped',
    'duplicates_collapsed',
    'mapping',
    'unmapped_columns',
    'source_format',
    'encoding',
    'delimiter',
    'raw_storage_key',
    'normalized_storage_key',
    'quality_storage_key',
    'created_at',
  ]
  const values: unknown[] = [
    ...(preserveId ? [upload.id] : []),
    upload.file_hash,
    upload.filename,
    upload.source,
    upload.status,
    upload.rows_in,
    upload.rows_valid,
    upload.rows_dropped,
    upload.duplicates_collapsed,
    JSON.stringify(quality.mapped_columns),
    JSON.stringify(quality.unmapped_columns),
    quality.source_format,
    quality.encoding,
    quality.delimiter,
    `legacy/${upload.file_hash}`,
    null,
    null,
    upload.created_at,
  ]
  const placeholders = columns.map((column, index) => {
    if (column === 'mapping' || column === 'unmapped_columns') {
      return `$${index + 1}::jsonb`
    }
    return `$${index + 1}`
  })
  const quoted = columns.map((column) => `"${column}"`).join(', ')
  const result = await target.query<{ id: number }>(
    `INSERT INTO "uploads" (${quoted}) VALUES (${placeholders.join(', ')}) RETURNING "id"`,
    values,
  )
  const id = result.rows[0]?.id
  if (id === undefined) {
    throw new Error(`failed to insert upload ${upload.file_hash}`)
  }
  if (!preserveId) {
    console.warn(`  upload id ${upload.id} was taken; inserted as ${id}`)
  }
  return id
}

// Inserta los casos de la carga en lotes de CHUNK_SIZE filas
async function insertCases(
  target: Client,
  uploadId: number,
  rows: readonly CanonicalRow[],
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE)
    const values: unknown[] = []
    const tuples: string[] = []
    for (const row of chunk) {
      const start = values.length
      values.push(uploadId, ...CANONICAL_COLUMNS.map((column) => row[column]), naturalKey(row))
      tuples.push(
        `(${Array.from({ length: CASE_COLUMNS.length }, (_, index) => `$${start + index + 1}`).join(', ')})`,
      )
    }
    const quoted = CASE_COLUMNS.map((column) => `"${column}"`).join(', ')
    await target.query(
      `INSERT INTO "surveillance_cases" (${quoted}) VALUES ${tuples.join(', ')}`,
      values,
    )
  }
}

// Inserta los problemas de calidad de la carga en orden
async function insertIssues(
  target: Client,
  uploadId: number,
  issues: readonly LegacyIssue[],
): Promise<void> {
  for (const [position, issue] of issues.entries()) {
    await target.query(
      `INSERT INTO "upload_quality_issues"
         ("upload_id", "position", "code", "message", "count", "sample")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [uploadId, position, issue.code, issue.message, issue.count, JSON.stringify(issue.sample)],
    )
  }
}

// Ajusta la secuencia de ids de uploads al máximo id existente
async function resetUploadSequence(target: Client): Promise<void> {
  await target.query(
    `SELECT setval(
       pg_get_serial_sequence('"uploads"', 'id'),
       COALESCE((SELECT MAX("id") FROM "uploads"), 1),
       (SELECT COUNT(*) > 0 FROM "uploads")
     )`,
  )
}

// Convierte un registro del Parquet en una fila canónica tipada
function canonicalRow(row: Record<string, unknown>): CanonicalRow {
  return {
    disease: textValue(row.disease),
    ubigeo: textValue(row.ubigeo),
    year: numberValue(row.year),
    epi_week: numberValue(row.epi_week),
    department: textValue(row.department),
    province: textValue(row.province),
    district: textValue(row.district),
    directorate: textValue(row.directorate),
    sex: textValue(row.sex),
    age_group: textValue(row.age_group),
    age_type: textValue(row.age_type),
    diagnosis: textValue(row.diagnosis),
    diagnosis_type: textValue(row.diagnosis_type),
    cases: numberValue(row.cases),
  }
}

// Calcula el hash SHA-256 de las columnas clave de la fila
function naturalKey(row: CanonicalRow): string {
  return createHash('sha256')
    .update(JSON.stringify(KEY_COLUMNS.map((column) => row[column])))
    .digest('hex')
}

// Convierte un valor a texto, usando cadena vacía para nulos
function textValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

// Convierte un valor a número y falla si no es finito
function numberValue(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid numeric value: ${String(value)}`)
  }
  return parsed
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
