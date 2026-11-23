import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DashboardResponseSchema, type DashboardResponse, type UploadDto } from '@vigia/contracts'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/common/config/app-config'
import { createDataSource } from '../src/common/database/data-source'
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const token = process.env.VIGIA_ACCESS_TOKEN ?? 'test-token'

const ANEMIA = [
  'distrito;sexo;hemoglobina;anemia',
  'HUANCAYO;F;11,2;NO',
  'HUANCAYO;M;10,1;SI',
  'CHILCA;F;9,8;SI',
  'CHILCA;M;12,0;NO',
  'EL TAMBO;F;10,9;SI',
  'EL TAMBO;M;11,5;NO',
].join('\n')

const EGRESOS = [
  'Id;sexo;fecing;PROCEDENCIA',
  'A1;F;14/07/2026;LIMA-LIMA-ATE',
  'A2;M;21/07/2026;LIMA-LIMA-ATE',
  'A3;F;28/07/2026;CUSCO-CUSCO-SANTIAGO',
  'A4;M;04/08/2026;DEL CALLAO-CALLAO-CALLAO',
  'A5;F;11/08/2026;LIMA-LIMA-SAN BORJA',
].join('\n')

describe.skipIf(!dbEnabled)('dashboard API against PostgreSQL', () => {
  let app: INestApplication
  let server: Server
  let dataSource: DataSource

  beforeAll(async () => {
    delete process.env.DEEPSEEK_API_KEY
    dataSource = createDataSource(loadConfig())
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

  // Sube un CSV sin revisión (roles por reglas) y devuelve la carga creada
  async function upload(csv: string, filename: string): Promise<UploadDto> {
    const response = await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', Buffer.from(csv), { filename, contentType: 'text/csv' })
      .expect(200)
    return response.body as UploadDto
  }

  // Pide el tablero de una carga con un indicador opcional
  async function dashboard(uploadId: number, indicator?: string): Promise<DashboardResponse> {
    const response = await request(server)
      .get('/api/dashboard')
      .query({ upload_id: uploadId, ...(indicator ? { indicator } : {}) })
      .set('X-Access-Token', token)
      .expect(200)
    return DashboardResponseSchema.parse(response.body)
  }

  it('arma el tablero de anemia sin serie temporal', async () => {
    const created = await upload(ANEMIA, 'anemia.csv')
    expect(created.indicators.map((item) => item.id)).toEqual(['records', 'mean:hemoglobina'])

    const body = await dashboard(created.id, 'mean:hemoglobina')
    expect(body.granularity).toBeNull()
    expect(body.indicator).toEqual({ id: 'mean:hemoglobina', label: 'hemoglobina promedio' })
    expect(body.widgets.map((widget) => widget.type)).toEqual([
      'kpis',
      'ranking',
      'breakdown',
      'breakdown',
      'histogram',
    ])
    const anemia = body.widgets.find((widget) => widget.id === 'breakdown:anemia')
    expect(anemia?.type === 'breakdown' && anemia.rows).toEqual([
      { name: 'NO', value: 11.567 },
      { name: 'SI', value: 10.267 },
    ])
  })

  it('arma el tablero de egresos con serie semanal y ranking por departamento', async () => {
    const created = await upload(EGRESOS, 'egresos.csv')
    const body = await dashboard(created.id)

    expect(body.granularity).toBe('day')
    expect(body.years).toEqual([2026])
    const series = body.widgets.find((widget) => widget.type === 'timeseries')
    const points = series?.type === 'timeseries' ? series.points : []
    expect(points).toHaveLength(29)
    expect(points.filter((point) => point.value === 1)).toHaveLength(5)
    expect(points.every((point) => point.value === 0 || point.value === 1)).toBe(true)
    const ranking = body.widgets.find((widget) => widget.type === 'ranking')
    expect(ranking?.type === 'ranking' && ranking.rows).toEqual([
      { name: 'LIMA', value: 3 },
      { name: 'CALLAO', value: 1 },
      { name: 'CUSCO', value: 1 },
    ])
  })

  it('devuelve los años con datos de una carga', async () => {
    const created = await upload(EGRESOS, 'egresos.csv')
    const response = await request(server)
      .get(`/api/uploads/${created.id}/years`)
      .set('X-Access-Token', token)
      .expect(200)
    expect(response.body).toEqual([2026])
  })

  it('responde 404 para una carga inexistente', async () => {
    await request(server)
      .get('/api/dashboard')
      .query({ upload_id: 999 })
      .set('X-Access-Token', token)
      .expect(404)
  })
})
