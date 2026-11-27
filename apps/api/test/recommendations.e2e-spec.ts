import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { RecommendationsResponseSchema } from '@vigia/contracts'
import request, { type Test as SupertestTest } from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { adminBearer } from './auth'
import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/common/config/app-config'
import { createDataSource } from '../src/common/database/data-source'
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter'
import { fixture } from './support'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
let auth = ''

describe.skipIf(!dbEnabled)('recommendations against PostgreSQL', () => {
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
    auth = await adminBearer(dataSource)
    server = app.getHttpServer() as Server
  })

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "uploads" RESTART IDENTITY CASCADE')
    await dataSource.query('TRUNCATE TABLE "model_registry" RESTART IDENTITY')
  })

  afterAll(async () => {
    await app?.close()
    await dataSource?.destroy()
  })

  // Arma una petición GET autenticada con la sesión del administrador
  function get(path: string): SupertestTest {
    return request(server).get(path).set('Authorization', auth)
  }

  it('returns the no-data envelopes', async () => {
    await get('/api/recommendations')
      .expect(404)
      .expect({ detail: 'sin datos: sube un archivo de vigilancia' })
    await get('/api/recommendations?upload_id=9999')
      .expect(404)
      .expect({ detail: 'carga no encontrada' })
  })

  it('requires a session', async () => {
    await request(server).get('/api/recommendations').expect(401)
  })

  it('builds a traffic light per department with a template summary', async () => {
    const uploaded = await request(server)
      .post('/api/upload')
      .set('Authorization', auth)
      .attach('file', fixture('demo_624.csv'), {
        filename: 'demo_624.csv',
        contentType: 'text/csv',
      })
      .expect(200)
    const uploadId = (uploaded.body as { id: number }).id

    const response = await get(`/api/recommendations?upload_id=${uploadId}`).expect(200)
    const body = RecommendationsResponseSchema.parse(response.body)

    expect(body.items.map((item) => item.department).sort()).toEqual([
      'AMAZONAS',
      'LIMA',
      'LORETO',
      'PIURA',
    ])
    expect(body.counts.alto + body.counts.medio + body.counts.bajo).toBe(4)
    expect(body.window).toEqual({
      from: { year: 2024, epi_week: 43 },
      to: { year: 2024, epi_week: 46 },
    })
    expect(body.summary.source).toBe('template')
    expect(body.summary.headline.length).toBeGreaterThan(0)
    expect(body.outlook.complete_years).toBe(3)
    expect(body.outlook.confidence).toBe('baja')
    expect(body.outlook.total.projection.map((row) => row.year)).toEqual([
      2025, 2026, 2027, 2028, 2029,
    ])
    for (const row of body.outlook.total.projection) {
      expect(row.p10).toBeLessThanOrEqual(row.p50)
      expect(row.p50).toBeLessThanOrEqual(row.p90)
    }
    expect(body.outlook.departments).toHaveLength(4)

    for (const item of body.items) {
      expect(item.reasons.length).toBeGreaterThan(0)
      expect(item.actions.length).toBeGreaterThan(0)
    }
  })
})
