import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { EmptyFile, MissingRequiredColumns, PiiDetected, UnsupportedFile } from '../domain/errors'
import { ingestUpload, previewUpload } from './ingest'

const HEADER =
  'departamento,provincia,distrito,enfermedad,ano,semana,' +
  'diagnostico,tipo_diagnostico,ubigeo,edad,tipo_edad,sexo,casos\n'

interface IngestSnapshot {
  file_hash: string
  status: string
  rows_in: number
  rows_valid: number
  rows_dropped: number
  duplicates_collapsed: number
  mapping: Record<string, string>
  unmapped_columns: string[]
  quality: Record<string, unknown>
  rows: unknown[]
}

// Lee un archivo de fixtures normalizando los saltos de línea a LF
function fixture(name: string): Buffer {
  const raw = readFileSync(resolve(process.cwd(), 'test', 'fixtures', name))
  return Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
}

// Carga el snapshot JSON esperado de una ingesta
function snapshot(name: string): IngestSnapshot {
  const path = resolve(process.cwd(), 'test', 'snapshots', name)
  return JSON.parse(readFileSync(path, 'utf8')) as IngestSnapshot
}

// Ingiere un fixture con la fuente minsa_dengue
function upload(name: string) {
  return ingestUpload({
    data: fixture(name),
    filename: name,
    source: 'minsa_dengue',
  })
}

describe('ingestion parity with the frozen fixtures', () => {
  it.each([
    ['minsa_dengue_clean.csv', 'ingest_clean.json'],
    ['analysis_synthetic.csv', 'ingest_synthetic.json'],
    ['demo_624.csv', 'ingest_demo.json'],
  ])('matches %s row for row', async (fixtureName, snapshotName) => {
    const result = await upload(fixtureName)
    const expected = snapshot(snapshotName)

    expect(result.fileHash).toBe(expected.file_hash)
    expect(result.status).toBe(expected.status)
    expect(result.rowsIn).toBe(expected.rows_in)
    expect(result.rowsValid).toBe(expected.rows_valid)
    expect(result.rowsDropped).toBe(expected.rows_dropped)
    expect(result.duplicatesCollapsed).toBe(expected.duplicates_collapsed)
    expect(result.mapping).toEqual(expected.mapping)
    expect(result.unmappedColumns).toEqual(expected.unmapped_columns)
    expect({
      rows_in: result.rowsIn,
      rows_valid: result.rowsValid,
      rows_dropped: result.rowsDropped,
      duplicates_collapsed: result.duplicatesCollapsed,
      mapped_columns: result.mapping,
      unmapped_columns: result.unmappedColumns,
      issues: result.issues,
      source_format: result.sourceFormat,
      encoding: result.encoding,
      delimiter: result.delimiter,
    }).toEqual(expected.quality)
    expect(result.rows).toEqual(expected.rows)
  })

  it('previews the demo mapping exactly like the API snapshot', async () => {
    const preview = await previewUpload({
      data: fixture('demo_624.csv'),
      filename: 'historico.csv',
      source: 'minsa_dengue',
    })
    const expected = JSON.parse(
      readFileSync(resolve(process.cwd(), 'test', 'snapshots', 'api_preview_demo.json'), 'utf8'),
    ) as unknown
    expect(preview).toEqual(expected)
  })
})

describe('ingestion rejection paths', () => {
  it('rejects personal-data columns before writing anything', async () => {
    const csv = Buffer.from(
      'departamento,ano,semana,ubigeo,casos,dni\nLORETO,2024,1,160110,2,12345678\n',
    )
    await expect(
      ingestUpload({ data: csv, filename: 'pii.csv', source: 'minsa_dengue' }),
    ).rejects.toThrow(PiiDetected)
    await expect(
      ingestUpload({ data: csv, filename: 'pii.csv', source: 'minsa_dengue' }),
    ).rejects.toThrow('Upload contains personal-data columns and was rejected: dni')
  })

  it('rejects a file without the required natural-key columns', async () => {
    const csv = Buffer.from('departamento,ano,semana,casos\nLORETO,2024,1,2\n')
    await expect(
      ingestUpload({ data: csv, filename: 'missing.csv', source: 'minsa_dengue' }),
    ).rejects.toThrow(MissingRequiredColumns)
  })

  it('rejects legacy workbook formats', async () => {
    await expect(
      ingestUpload({
        data: Buffer.from('not an xls'),
        filename: 'historico.xls',
        source: 'minsa_dengue',
      }),
    ).rejects.toThrow(UnsupportedFile)
  })

  it('rejects a header-only csv', async () => {
    await expect(
      ingestUpload({
        data: Buffer.from(HEADER),
        filename: 'empty.csv',
        source: 'minsa_dengue',
      }),
    ).rejects.toThrow(EmptyFile)
  })
})

describe('normalization rules', () => {
  it('collapses duplicate natural keys and sums their cases', async () => {
    const row =
      'LORETO,MAYNAS,IQUITOS,DENGUE,2024,1,DENGUE SIN SIGNOS DE ALARMA,CONFIRMADO,160110,12,ANOS,F'
    const result = await ingestUpload({
      data: Buffer.from(`${HEADER}${row},2\n${row},3\n`),
      filename: 'duplicates.csv',
      source: 'minsa_dengue',
    })

    expect(result.rowsIn).toBe(2)
    expect(result.rowsValid).toBe(1)
    expect(result.duplicatesCollapsed).toBe(1)
    expect(result.rows[0]?.cases).toBe(5)
    expect(result.status).toBe('ok')
  })

  it('classifies dropped rows and keeps a Spanish quality message', async () => {
    const row =
      'LORETO,MAYNAS,IQUITOS,DENGUE,2024,1,DENGUE SIN SIGNOS DE ALARMA,CONFIRMADO,12AB,12,ANOS,F,2'
    const result = await ingestUpload({
      data: Buffer.from(`${HEADER}${row}\n`),
      filename: 'invalid-ubigeo.csv',
      source: 'minsa_dengue',
    })

    expect(result.rowsValid).toBe(0)
    expect(result.rowsDropped).toBe(1)
    expect(result.status).toBe('ok_with_issues')
    expect(result.issues).toEqual([
      {
        code: 'invalid_ubigeo',
        message: 'UBIGEO is not a 6-digit code.',
        count: 1,
        sample: ['12AB'],
      },
    ])
  })

  it('reads the same contract from an xlsx workbook', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('datos')
    sheet.addRow([
      'departamento',
      'provincia',
      'distrito',
      'enfermedad',
      'ano',
      'semana',
      'diagnostico',
      'tipo_diagnostico',
      'ubigeo',
      'edad',
      'tipo_edad',
      'sexo',
      'casos',
    ])
    sheet.addRow([
      'LORETO',
      'MAYNAS',
      'IQUITOS',
      'DENGUE',
      2024,
      1,
      'DENGUE SIN SIGNOS DE ALARMA',
      'CONFIRMADO',
      '160110',
      12,
      'ANOS',
      'F',
      3,
    ])
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

    const result = await ingestUpload({
      data: buffer,
      filename: 'historico.xlsx',
      source: 'minsa_dengue',
    })

    expect(result.sourceFormat).toBe('xlsx')
    expect(result.encoding).toBeNull()
    expect(result.delimiter).toBeNull()
    expect(result.rows).toEqual([
      {
        disease: 'DENGUE',
        ubigeo: '160110',
        year: 2024,
        epi_week: 1,
        department: 'LORETO',
        province: 'MAYNAS',
        district: 'IQUITOS',
        directorate: '',
        sex: 'F',
        age_group: '10-19',
        age_type: 'ANOS',
        diagnosis: 'DENGUE SIN SIGNOS DE ALARMA',
        diagnosis_type: 'CONFIRMADO',
        cases: 3,
      },
    ])
  })

  it('fills trailing columns missing from a short csv row', async () => {
    const result = await ingestUpload({
      data: Buffer.from(`${HEADER}LORETO,MAYNAS,IQUITOS,DENGUE,2024,1,,,160110\n`),
      filename: 'short.csv',
      source: 'minsa_dengue',
    })

    expect(result.rowsIn).toBe(1)
    expect(result.rowsValid).toBe(0)
    expect(result.rowsDropped).toBe(1)
    expect(result.issues.map((issue) => issue.code)).toEqual(['missing_cases'])
  })

  it('keeps an all-empty comma row instead of silently dropping it', async () => {
    const result = await ingestUpload({
      data: Buffer.from(`${HEADER},,,,,,,,,,,,\n`),
      filename: 'comma-only.csv',
      source: 'minsa_dengue',
    })

    expect(result.rowsIn).toBe(1)
    expect(result.rowsValid).toBe(0)
    expect(result.rowsDropped).toBe(1)
    expect(result.status).toBe('ok_with_issues')
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'missing_ubigeo',
      'invalid_year',
      'invalid_epi_week',
      'missing_cases',
    ])
  })
})
