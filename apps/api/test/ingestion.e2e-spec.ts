import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { UploadPreviewSchema, type UploadPreview } from '@vigia/contracts'
import { toEpiMapping } from '@vigia/epidemiology'
import request, { type Response } from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/common/config/app-config'
import { createDataSource } from '../src/common/database/data-source'
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter'
import { SurveillanceCaseEntity } from '../src/modules/datasets/entities/surveillance-case.entity'
import { UploadEntity } from '../src/modules/datasets/entities/upload.entity'
import { fixture, snapshot } from './support'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const token = process.env.VIGIA_ACCESS_TOKEN ?? 'test-token'

describe.skipIf(!dbEnabled)('ingestion API against PostgreSQL', () => {
  let app: INestApplication
  let server: Server
  let dataSource: DataSource

  beforeAll(async () => {
    delete process.env.DEEPSEEK_API_KEY
    const config = loadConfig()
    dataSource = createDataSource(config)
    await dataSource.initialize()
    await dataSource.runMigrations()

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
    server = app.getHttpServer() as Server
  })

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "uploads" RESTART IDENTITY CASCADE')
  })

  afterAll(async () => {
    await app?.close()
    await dataSource?.destroy()
  })

  // Sube el dataset demo al API y espera respuesta 200
  async function uploadDemo(): Promise<Response> {
    return request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', fixture('demo_624.csv'), {
        filename: 'historico.csv',
        contentType: 'text/csv',
      })
      .expect(200)
  }

  it('uploads the demo dataset and matches the API snapshot', async () => {
    const response = await uploadDemo()
    const expected = snapshot('api_upload.json') as Record<string, unknown>
    const { created_at: createdAt, ...payload } = response.body as Record<string, unknown>

    expect(payload).toEqual(
      Object.fromEntries(Object.entries(expected).filter(([key]) => key !== 'created_at')),
    )
    expect(typeof createdAt).toBe('string')
    expect(Number.isNaN(Date.parse(String(createdAt)))).toBe(false)

    expect(await dataSource.getRepository(UploadEntity).count()).toBe(1)
    expect(await dataSource.getRepository(SurveillanceCaseEntity).count()).toBe(624)
  })

  it('is idempotent by file hash', async () => {
    const first = await uploadDemo()
    const second = await uploadDemo()

    expect(second.body.id).toBe(first.body.id)
    expect(await dataSource.getRepository(UploadEntity).count()).toBe(1)
    expect(await dataSource.getRepository(SurveillanceCaseEntity).count()).toBe(624)
  })

  it('reconstructs the quality report stored for the upload', async () => {
    const uploaded = await uploadDemo()
    const response = await request(server)
      .get(`/api/uploads/${uploaded.body.id}/quality`)
      .set('X-Access-Token', token)
      .expect(200)

    expect(response.body).toEqual(snapshot('api_quality.json'))
  })

  // Pide la vista previa de un archivo y devuelve el uso sugerido de cada columna
  async function preview(csv: Buffer, filename: string): Promise<UploadPreview> {
    const response = await request(server)
      .post('/api/upload/preview')
      .set('X-Access-Token', token)
      .attach('file', csv, { filename, contentType: 'text/csv' })
      .expect(200)
    return response.body as UploadPreview
  }

  // Sube un archivo confirmando las columnas sugeridas por la vista previa
  async function uploadReviewed(csv: Buffer, filename: string, body: UploadPreview) {
    const columns = body.columns.map(({ samples: _samples, reason: _reason, ...column }) => column)
    return request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .field('columns', JSON.stringify(columns))
      .field('title', body.title)
      .field('topic', body.topic)
      .attach('file', csv, { filename, contentType: 'text/csv' })
      .expect(200)
  }

  // Cuenta las filas guardadas en una tabla
  async function count(table: string): Promise<number> {
    const rows = await dataSource.query<Array<{ total: string }>>(
      `SELECT COUNT(*) AS total FROM "${table}"`,
    )
    return Number(rows[0]?.total ?? 0)
  }

  it('previews the demo mapping without storing the upload', async () => {
    const body = await preview(fixture('demo_624.csv'), 'historico.csv')
    const expected = snapshot('api_preview_demo.json') as { mapping: Record<string, string> }

    expect(UploadPreviewSchema.parse(body)).toEqual(body)
    expect(body.suggested_by).toBe('rules')
    expect(toEpiMapping(body.columns)).toEqual(expected.mapping)
    expect(await dataSource.getRepository(UploadEntity).count()).toBe(0)
  })

  it('accepts PII columns but never stores them', async () => {
    const csv = Buffer.from(
      'departamento,ano,semana,ubigeo,casos,dni\nLORETO,2024,1,160110,2,12345678\n',
    )

    const body = await preview(csv, 'pii.csv')
    expect(body.pii_detected).toEqual(['dni'])
    expect(body.suggested_by).toBe('rules')

    const upload = await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', csv, { filename: 'pii.csv', contentType: 'text/csv' })
      .expect(200)
    expect(upload.body).toMatchObject({ rows_valid: 1 })
    const stored = await dataSource.query<{ data: Record<string, unknown> }[]>(
      'SELECT data FROM dataset_rows',
    )
    expect(stored).toHaveLength(1)
    expect(stored.every((row) => !('dni' in row.data))).toBe(true)
  })

  it('stores a file without place as a generic dataset', async () => {
    const csv = Buffer.from('ano,semana,casos\n2024,1,2\n')

    const upload = await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', csv, { filename: 'sin-lugar.csv', contentType: 'text/csv' })
      .expect(200)
    expect(upload.body).toMatchObject({ epi: false, time: 'week', rows_in: 1, rows_valid: 1 })
    expect(await count('dataset_rows')).toBe(1)
    expect(await count('surveillance_cases')).toBe(0)
  })

  it('carga un dataset de anemia sin fecha', async () => {
    const csv = Buffer.from(
      [
        'distrito;sexo;edad_meses;hemoglobina;anemia',
        'HUANCAYO;F;12;11,2;NO',
        'HUANCAYO;M;18;10,1;SI',
        'CHILCA;F;24;9,8;SI',
        'CHILCA;M;9;12,0;NO',
        'EL TAMBO;F;30;10,9;SI',
        'EL TAMBO;M;14;11,5;NO',
      ].join('\n'),
    )
    const body = await preview(csv, 'anemia_junin.csv')
    const upload = await uploadReviewed(csv, 'anemia_junin.csv', { ...body, topic: 'anemia' })

    expect(upload.body).toMatchObject({
      epi: false,
      time: 'none',
      topic: 'anemia',
      title: 'anemia_junin',
      rows_valid: 6,
    })
    expect(await count('dataset_rows')).toBe(6)
    expect(await count('surveillance_cases')).toBe(0)
    const stored = await dataSource.query<Array<{ data: Record<string, unknown> }>>(
      'SELECT data FROM "dataset_rows" ORDER BY row_number LIMIT 1',
    )
    expect(stored[0]?.data).toMatchObject({ distrito: 'HUANCAYO', hemoglobina: 11.2 })
  })

  it('rejects a file without any useful column', async () => {
    const csv = Buffer.from('Id\nA1\nA2\n')
    const upload = await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', csv, { filename: 'ids.csv', contentType: 'text/csv' })
      .expect(422)
    expect(String(upload.body.detail)).toContain('no tiene columnas utilizables')
  })

  it('loads a hospital line list with dates and a combined location', async () => {
    const csv = Buffer.from(
      [
        'Id;sexo;edad;tipoedad;fecing;fecegr;PROCEDENCIA;FECHA_CORTE',
        'AAA1;FEMENINO;11;AÑOS;14/07/2026;16/07/2026;LIMA-LIMA-SANTA ANITA;13/11/2026',
        'AAA2;MASCULINO;10;DIAS;18/07/2026;20/07/2026;DEL CALLAO-CALLAO-CALLAO;13/11/2026',
      ].join('\r\n'),
      'latin1',
    )
    const body = await preview(csv, 'egresos.csv')
    expect(toEpiMapping(body.columns)).toMatchObject({
      event_date: 'fecing',
      location: 'PROCEDENCIA',
    })

    const upload = await uploadReviewed(csv, 'egresos.csv', body)
    expect(upload.body).toMatchObject({ status: 'ok', rows_in: 2, rows_valid: 2, epi: true })
    const stored = await dataSource.query<Array<{ data: Record<string, unknown> }>>(
      'SELECT data FROM "dataset_rows"',
    )
    expect(stored.every((row) => !('Id' in row.data) && !('FECHA_CORTE' in row.data))).toBe(true)

    const series = await request(server)
      .get('/api/analysis/series')
      .set('X-Access-Token', token)
      .expect(200)
    expect(
      (series.body as Array<{ department: string; year: number; epi_week: number }>).map((row) => [
        row.department,
        row.year,
        row.epi_week,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['LIMA', 2026, 28],
        ['CALLAO', 2026, 28],
      ]),
    )
  })
})
