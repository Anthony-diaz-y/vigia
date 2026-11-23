import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request, { type Response, type Test as SupertestTest } from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/common/config/app-config'
import { createDataSource } from '../src/common/database/data-source'
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter'
import { fixture, snapshot } from './support'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const token = process.env.VIGIA_ACCESS_TOKEN ?? 'test-token'

describe.skipIf(!dbEnabled)('analysis API against PostgreSQL', () => {
  let app: INestApplication
  let server: Server
  let dataSource: DataSource

  beforeAll(async () => {
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

  // Sube un CSV de fixtures al API y espera respuesta 200
  async function upload(name: string): Promise<Response> {
    return request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', fixture(name), {
        filename: name,
        contentType: 'text/csv',
      })
      .expect(200)
  }

  // Arma una petición GET autenticada con el token de acceso
  function get(path: string): SupertestTest {
    return request(server).get(path).set('X-Access-Token', token)
  }

  it('returns the legacy no-data envelope without uploads', async () => {
    await get('/api/analysis/series')
      .expect(404)
      .expect({ detail: 'sin datos: sube un archivo de vigilancia' })
    await get('/api/analysis/series?upload_id=9999')
      .expect(404)
      .expect({ detail: 'carga no encontrada' })
  })

  it('serves the demo analysis snapshots from SQL', async () => {
    await upload('demo_624.csv')

    const series = await get('/api/analysis/series').expect(200)
    expect(series.body).toEqual(snapshot('api_series.json'))

    const interannual = await get('/api/analysis/interannual').expect(200)
    expect(interannual.body).toEqual(snapshot('api_interannual.json'))

    const heatmap = await get('/api/analysis/heatmap?year=2024').expect(200)
    expect(heatmap.body).toEqual(snapshot('api_heatmap_2024.json'))

    const ranking = await get('/api/analysis/ranking?year=2024').expect(200)
    expect(ranking.body).toEqual(snapshot('api_ranking_2024.json'))

    const anomalies = await get('/api/analysis/anomalies').expect(200)
    expect(anomalies.body).toEqual(snapshot('api_anomalies.json'))
  })

  it('serves the synthetic analysis snapshots and province groups', async () => {
    await upload('analysis_synthetic.csv')

    expect((await get('/api/analysis/series').expect(200)).body).toEqual(
      snapshot('analysis_synthetic_weekly_series.json'),
    )
    expect((await get('/api/analysis/interannual').expect(200)).body).toEqual(
      snapshot('analysis_synthetic_interannual.json'),
    )
    expect((await get('/api/analysis/heatmap?year=2024').expect(200)).body).toEqual(
      snapshot('analysis_synthetic_heatmap_2024.json'),
    )
    expect((await get('/api/analysis/anomalies').expect(200)).body).toEqual(
      snapshot('analysis_synthetic_anomalies.json'),
    )
    expect((await get('/api/analysis/ranking?year=2024').expect(200)).body).toEqual([
      { rank: 1, department: 'LIMA', cases: 69 },
      { rank: 2, department: 'PIURA', cases: 66 },
    ])

    const provinceSeries = await get('/api/analysis/series?level=province').expect(200)
    expect(provinceSeries.body).toHaveLength(27)
    expect(provinceSeries.body[0]).toEqual({
      department: 'LIMA',
      province: 'LIMA',
      year: 2022,
      epi_week: 1,
      cases: 5,
    })
    expect((await get('/api/analysis/heatmap?year=2024&level=province').expect(200)).body).toEqual({
      geographies: ["('LIMA', 'LIMA')", "('PIURA', 'PIURA')", "('PIURA', 'SULLANA')"],
      weeks: [1, 2, 3],
      values: [
        [7, 12, 50],
        [20, 20, 20],
        [2, 2, 2],
      ],
    })
  })

  it('scopes reads to one upload', async () => {
    const clean = await upload('minsa_dengue_clean.csv')
    const demo = await upload('demo_624.csv')

    const scoped = await get(
      `/api/analysis/ranking?year=2024&upload_id=${clean.body.id as number}`,
    ).expect(200)
    expect(scoped.body).toEqual([
      { rank: 1, department: 'PIURA', cases: 13 },
      { rank: 2, department: 'LORETO', cases: 11 },
      { rank: 3, department: 'AMAZONAS', cases: 2 },
      { rank: 4, department: 'LIMA', cases: 2 },
    ])

    expect(
      (await get(`/api/analysis/series?upload_id=${demo.body.id as number}`).expect(200)).body,
    ).toEqual(snapshot('api_series.json'))
  })

  it('rejects malformed query values with the legacy envelope', async () => {
    await get('/api/analysis/series?upload_id=abc')
      .expect(422)
      .expect({ detail: 'upload_id must be an integer' })
    await get('/api/analysis/heatmap').expect(422).expect({ detail: 'year is required' })
  })
})
