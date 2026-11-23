import { PassThrough } from 'node:stream'

import { Inject, Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { CANONICAL_COLUMNS } from '@vigia/epidemiology'
import { ParquetSchema, ParquetWriter } from 'parquetjs-lite'
import { DataSource } from 'typeorm'

import { AnalysisRepository } from '../../analysis/repositories/analysis.repository'

export interface ExportFile {
  buffer: Buffer
  filename: string
  contentType: string
}

type CaseRow = Record<string, string | number>

const COLUMN_TYPES: Record<string, 'UTF8' | 'INT32'> = {
  disease: 'UTF8',
  ubigeo: 'UTF8',
  year: 'INT32',
  epi_week: 'INT32',
  department: 'UTF8',
  province: 'UTF8',
  district: 'UTF8',
  directorate: 'UTF8',
  sex: 'UTF8',
  age_group: 'UTF8',
  age_type: 'UTF8',
  diagnosis: 'UTF8',
  diagnosis_type: 'UTF8',
  cases: 'INT32',
}

const STORAGE_SCHEMA = new ParquetSchema(
  Object.fromEntries(
    CANONICAL_COLUMNS.map((column) => [column, { type: COLUMN_TYPES[column] ?? 'UTF8' }]),
  ),
)

@Injectable()
export class ExportService {
  constructor(
    @Inject(AnalysisRepository) private readonly analysis: AnalysisRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Exporta los casos en CSV o Parquet, opcionalmente filtrados por carga
  async export(format: string, uploadId?: number): Promise<ExportFile> {
    await this.analysis.assertScope(uploadId)
    const rows = await this.rows(uploadId)
    if (format === 'parquet') {
      return {
        buffer: await toParquet(rows),
        filename: 'vigia.parquet',
        contentType: 'application/octet-stream',
      }
    }
    return {
      buffer: Buffer.from(toCsv(rows), 'utf8'),
      filename: 'vigia.csv',
      contentType: 'text/csv',
    }
  }

  // Lee de la base de datos los casos con las columnas canónicas
  private async rows(uploadId?: number): Promise<CaseRow[]> {
    const selected = CANONICAL_COLUMNS.map((column) => `"${column}"`).join(', ')
    const where = uploadId === undefined ? '' : 'WHERE "upload_id" = $1'
    const parameters = uploadId === undefined ? [] : [uploadId]
    return this.dataSource.query<CaseRow[]>(
      `SELECT ${selected} FROM "surveillance_cases" ${where} ORDER BY "upload_id", "id"`,
      parameters,
    )
  }
}

// Convierte las filas en texto CSV con encabezado
function toCsv(rows: readonly CaseRow[]): string {
  const lines = [CANONICAL_COLUMNS.join(',')]
  for (const row of rows) {
    lines.push(CANONICAL_COLUMNS.map((column) => csvField(row[column] ?? '')).join(','))
  }
  return `${lines.join('\n')}\n`
}

// Pone comillas a un valor solo si rompería el CSV (como QUOTE_MINIMAL de pandas)
function csvField(value: string | number): string {
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

// Escribe las filas en un archivo Parquet en memoria y devuelve sus bytes
async function toParquet(rows: readonly CaseRow[]): Promise<Buffer> {
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  stream.on('data', (chunk: Buffer) => chunks.push(chunk))
  const ended = new Promise<void>((resolve, reject) => {
    stream.once('end', resolve)
    stream.once('error', reject)
  })

  const writer = await ParquetWriter.openStream(STORAGE_SCHEMA, stream)
  for (const row of rows) {
    await writer.appendRow(row)
  }
  await writer.close()
  await ended
  return Buffer.concat(chunks)
}
