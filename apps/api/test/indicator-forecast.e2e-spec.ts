import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { IndicatorForecastResponseSchema, type UploadDto } from '@vigia/contracts'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/common/config/app-config'
import { createDataSource } from '../src/common/database/data-source'
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const token = process.env.VIGIA_ACCESS_TOKEN ?? 'test-token'

// Listado sintético de 3 años con un caso por día en temporada alta y menos en temporada baja
function seasonalLineList(): string {
  const lines = ['fecha_inicio;departamento']
  const start = Date.UTC(2022, 0, 2)
  for (let day = 0; day < 3 * 364; day += 1) {
    const season = Math.sin((2 * Math.PI * (day % 364)) / 364)
    const perDay = season > 0.3 ? 3 : season > -0.3 ? 2 : 1
    const date = new Date(start + day * 86_400_000).toISOString().slice(0, 10)
    for (let index = 0; index < perDay; index += 1) {
      lines.push(`${date};${index % 2 === 0 ? 'PIURA' : 'LIMA'}`)
    }
  }
  return lines.join('\n')
}

describe.skipIf(!dbEnabled)('indicator forecast API against PostgreSQL', () => {
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

  // Sube un CSV con roles por reglas y devuelve la carga creada
  async function upload(csv: string, filename: string): Promise<UploadDto> {
    const response = await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', Buffer.from(csv), { filename, contentType: 'text/csv' })
      .expect(200)
    return response.body as UploadDto
  }

  // Pide el pronóstico del indicador de una carga
  async function forecast(uploadId: number) {
    const response = await request(server)
      .get('/api/forecast/indicator')
      .query({ upload_id: uploadId })
      .set('X-Access-Token', token)
      .expect(200)
    return IndicatorForecastResponseSchema.parse(response.body)
  }

  it('pronostica semanas de un listado con 3 años de historia', async () => {
    const created = await upload(seasonalLineList(), 'listado.csv')
    const body = await forecast(created.id)

    expect(body.granularity).toBe('week')
    expect(body.history.length).toBeGreaterThan(100)
    if (body.status === 'publish') {
      expect(body.forecast).toHaveLength(4)
      expect(body.forecast[0]?.period).toMatch(/^\d{4}-S\d{2}$/)
    } else {
      expect(body.reason).not.toBeNull()
    }
    expect(body.outlook?.total.history.length).toBeGreaterThan(0)
  })

  it('explica por qué no hay pronóstico sin tiempo', async () => {
    const created = await upload('distrito;hemoglobina\nATE;11,2\nATE;10,1\n', 'anemia.csv')
    const body = await forecast(created.id)

    expect(body.granularity).toBeNull()
    expect(body.status).toBe('insufficient_evidence')
    expect(body.reason).toBe(
      'Este archivo no tiene fechas, semanas ni meses: no se puede pronosticar.',
    )
    expect(body.forecast).toEqual([])
    expect(body.outlook).toBeNull()
  })
})
