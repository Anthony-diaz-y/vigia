import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
  AnomalyRowSchema,
  RecommendationsResponseSchema,
  WeeklySeriesRowSchema,
  type UploadDto,
  type UploadPreview,
} from '@vigia/contracts'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/shared/config/app-config'
import { createDataSource } from '../src/shared/database/data-source'
import { HttpExceptionFilter } from '../src/shared/errors/http-exception.filter'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const token = process.env.VIGIA_ACCESS_TOKEN ?? 'test-token'

// Listado semanal de 30 semanas: fecha, lugar combinado y edad
function lineList(withPlace: boolean): string {
  const lines = [withPlace ? 'fecing;PROCEDENCIA;edad' : 'fecing;sexo;edad']
  const start = Date.UTC(2026, 0, 4)
  for (let week = 0; week < 30; week += 1) {
    const perWeek = week >= 20 ? 12 : 4
    for (let index = 0; index < perWeek; index += 1) {
      const date = new Date(start + (week * 7 + (index % 7)) * 86_400_000)
      const iso = date.toISOString().slice(0, 10)
      const place = index % 2 === 0 ? 'LIMA-LIMA-ATE' : 'PIURA-PIURA-CASTILLA'
      lines.push(`${iso};${withPlace ? place : index % 2 === 0 ? 'F' : 'M'};${20 + (index % 40)},5`)
    }
  }
  return lines.join('\n')
}

describe.skipIf(!dbEnabled)('adaptive tabs against PostgreSQL', () => {
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

  // Sube un archivo confirmando la vista previa con el tema indicado
  async function upload(csv: string, filename: string, topic: string): Promise<UploadDto> {
    const preview = await request(server)
      .post('/api/upload/preview')
      .set('X-Access-Token', token)
      .attach('file', Buffer.from(csv), { filename, contentType: 'text/csv' })
      .expect(200)
    const body = preview.body as UploadPreview
    const columns = body.columns.map(({ samples: _samples, reason: _reason, ...column }) => column)
    const response = await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .field('columns', JSON.stringify(columns))
      .field('title', body.title)
      .field('topic', topic)
      .attach('file', Buffer.from(csv), { filename, contentType: 'text/csv' })
      .expect(200)
    return response.body as UploadDto
  }

  // Hace un GET autenticado y devuelve el cuerpo
  async function get(path: string, query: Record<string, string | number>) {
    const response = await request(server)
      .get(path)
      .query(query)
      .set('X-Access-Token', token)
      .expect(200)
    return response.body as unknown
  }

  it('usa Total cuando no hay lugar', async () => {
    const created = await upload(lineList(false), 'sin-lugar.csv', 'egresos')
    expect(created.epi).toBe(false)

    const anomalies = AnomalyRowSchema.array().parse(
      await get('/api/analysis/anomalies', { upload_id: created.id }),
    )
    expect(new Set(anomalies.map((row) => row.department))).toEqual(new Set(['Total']))
  })

  it('calcula la serie con el indicador elegido', async () => {
    const created = await upload(lineList(true), 'egresos.csv', 'egresos hospitalarios')
    const series = WeeklySeriesRowSchema.array().parse(
      await get('/api/analysis/series', { upload_id: created.id, indicator: 'mean:edad' }),
    )
    expect(series.length).toBeGreaterThan(0)
    expect(series.some((row) => !Number.isInteger(row.cases))).toBe(true)
    expect(new Set(series.map((row) => row.department))).toEqual(new Set(['LIMA', 'PIURA']))
  })

  it('recomienda con acciones generales y el nombre del indicador fuera del dengue', async () => {
    const created = await upload(lineList(true), 'egresos.csv', 'egresos hospitalarios')
    const body = RecommendationsResponseSchema.parse(
      await get('/api/recommendations', { upload_id: created.id }),
    )
    expect(body.indicator_label).toBe('Registros')
    const actions = body.items.flatMap((item) => item.actions).join(' ')
    expect(actions).not.toMatch(/criadero|larvario/i)
    expect(body.items.every((item) => item.actions_source === 'rules')).toBe(true)
  })
})
