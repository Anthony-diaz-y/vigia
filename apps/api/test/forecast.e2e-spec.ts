import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request, { type Test as SupertestTest } from 'supertest'
import type { ExplainResponse } from '@vigia/contracts'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/shared/config/app-config'
import { createDataSource } from '../src/shared/database/data-source'
import { HttpExceptionFilter } from '../src/shared/errors/http-exception.filter'
import { fixture, snapshot } from './support'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const token = process.env.VIGIA_ACCESS_TOKEN ?? 'test-token'

interface ScoreRow {
  department: string
  province?: string
  windows: number
  mase: number | null
  wis: number | null
  status: string
}

interface QuantileRow {
  department: string
  province?: string
  horizon: number
  target_year: number
  target_epi_week: number
  p10: number
  p50: number
  p90: number
}

interface ForecastSnapshot {
  model_id: string
  scorecard: ScoreRow[]
  forecasts: QuantileRow[]
}

interface DriverRow {
  department: string
  province?: string
  rank: number
  feature: string
  driver: string
  mean_shap: number
  abs_mean_shap: number
  direction: 'up' | 'down'
  action: string
}

interface ExplainSnapshot {
  drivers: DriverRow[]
  narratives: Array<{ source: string; text: string }>
}

// Verifica que el valor sea nulo o un número cercano al esperado
function expectClose(actual: unknown, expected: number | null): void {
  if (expected === null) {
    expect(actual).toBeNull()
    return
  }
  expect(typeof actual).toBe('number')
  expect(actual as number).toBeCloseTo(expected, 8)
}

// Reemplaza la dirección de la tendencia en el texto por un marcador neutro
function normalizeDirection(text: string): string {
  return text.replace(/\((?:al alza|a la baja)\)/g, '(dir)')
}

describe.skipIf(!dbEnabled)('forecast and explanation against PostgreSQL', () => {
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
    await dataSource.query('TRUNCATE TABLE "model_registry" RESTART IDENTITY')
  })

  afterAll(async () => {
    await app?.close()
    await dataSource?.destroy()
  })

  // Sube un CSV de fixtures y devuelve el id de la carga
  async function upload(name: string): Promise<number> {
    const response = await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', fixture(name), {
        filename: name,
        contentType: 'text/csv',
      })
      .expect(200)
    return (response.body as { id: number }).id
  }

  // Arma una petición GET autenticada con el token de acceso
  function get(path: string): SupertestTest {
    return request(server).get(path).set('X-Access-Token', token)
  }

  it('returns the legacy no-data envelopes', async () => {
    await get('/api/forecast')
      .expect(404)
      .expect({ detail: 'sin datos: subí un archivo de vigilancia' })
    await get('/api/explain?upload_id=9999').expect(404).expect({ detail: 'carga no encontrada' })
  })

  it('serves the demo forecast snapshot and persists the registry row', async () => {
    await upload('demo_624.csv')
    const expected = snapshot('api_forecast.json') as ForecastSnapshot
    const response = await get('/api/forecast').expect(200)
    const body = response.body as ForecastSnapshot

    expect(body.model_id).toBe(expected.model_id)
    expect(body.scorecard).toHaveLength(expected.scorecard.length)
    expected.scorecard.forEach((row, index) => {
      const actual = body.scorecard[index]!
      expect(actual.department).toBe(row.department)
      expect(actual.windows).toBe(row.windows)
      expect(actual.status).toBe(row.status)
      expectClose(actual.mase, row.mase)
      expectClose(actual.wis, row.wis)
    })

    expect(body.forecasts).toHaveLength(expected.forecasts.length)
    expected.forecasts.forEach((row, index) => {
      const actual = body.forecasts[index]!
      expect(actual.department).toBe(row.department)
      expect(actual.horizon).toBe(row.horizon)
      expect(actual.target_year).toBe(row.target_year)
      expect(actual.target_epi_week).toBe(row.target_epi_week)
      expectClose(actual.p10, row.p10)
      expectClose(actual.p50, row.p50)
      expectClose(actual.p90, row.p90)
    })

    const registry = await dataSource.query<Array<{ model_id: string; forecasts: QuantileRow[] }>>(
      'SELECT "model_id", "forecasts" FROM "model_registry" WHERE "model_id" = $1',
      [expected.model_id],
    )
    expect(registry).toHaveLength(1)
    expect(registry[0]?.forecasts).toHaveLength(expected.forecasts.length)
  })

  it('serves the synthetic forecast snapshot', async () => {
    await upload('analysis_synthetic.csv')
    const expected = snapshot('forecast_synthetic.json') as ForecastSnapshot
    const response = await get('/api/forecast').expect(200)
    expect(response.body).toEqual({
      model_id: expected.model_id,
      scorecard: expected.scorecard,
      forecasts: expected.forecasts,
    })
  })

  it('serves the demo explanation snapshot', async () => {
    await upload('demo_624.csv')
    const expected = snapshot('api_explain.json') as ExplainSnapshot
    const response = await get('/api/explain').expect(200)
    const body = response.body as ExplainResponse

    expect(body.drivers).toHaveLength(expected.drivers.length)
    expected.drivers.forEach((row, index) => {
      const actual = body.drivers[index]!
      expect(actual.department).toBe(row.department)
      expect(actual.rank).toBe(row.rank)
      expect(actual.feature).toBe(row.feature)
      expect(actual.driver).toBe(row.driver)
      expect(actual.action).toBe(row.action)
      expectClose(actual.mean_shap, row.mean_shap)
      expectClose(actual.abs_mean_shap, row.abs_mean_shap)
      if (Math.abs(row.mean_shap) >= 1e-9 || Math.abs(actual.mean_shap) >= 1e-9) {
        expect(actual.direction).toBe(row.direction)
      }
    })

    expect(body.narratives).toHaveLength(expected.narratives.length)
    expected.narratives.forEach((row, index) => {
      const actual = body.narratives[index]!
      expect(actual.source).toBe(row.source)
      expect(row.text).toContain(`Para ${actual.department},`)
      expect(normalizeDirection(actual.text)).toBe(normalizeDirection(row.text))
    })
  })

  it('serves the synthetic explanation snapshot', async () => {
    await upload('analysis_synthetic.csv')
    const expected = snapshot('explain_synthetic.json') as ExplainSnapshot
    const response = await get('/api/explain').expect(200)
    expect(response.body).toEqual(expected)
  })

  it('scopes the forecast to one upload', async () => {
    await upload('minsa_dengue_clean.csv')
    const demo = await upload('demo_624.csv')
    const expected = snapshot('api_forecast.json') as ForecastSnapshot

    const scoped = await get(`/api/forecast?upload_id=${demo}`).expect(200)
    expect((scoped.body as ForecastSnapshot).model_id).toBe(expected.model_id)
  })

  it('rejects malformed query values with the legacy envelope', async () => {
    await get('/api/forecast?upload_id=abc')
      .expect(422)
      .expect({ detail: 'upload_id must be an integer' })
    await get('/api/explain?level=district')
      .expect(400)
      .expect({ detail: "level must be one of ('department', 'province'), got 'district'" })
  })
})
