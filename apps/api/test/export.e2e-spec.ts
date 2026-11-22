import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ParquetReader } from 'parquetjs-lite'
import request, { type Test as SupertestTest } from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/shared/config/app-config'
import { createDataSource } from '../src/shared/database/data-source'
import { HttpExceptionFilter } from '../src/shared/errors/http-exception.filter'
import { fixture, snapshotText } from './support'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const token = process.env.VIGIA_ACCESS_TOKEN ?? 'test-token'

describe.skipIf(!dbEnabled)('export API against PostgreSQL', () => {
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

  // Sube un CSV de fixtures y devuelve el id de la carga
  async function upload(name: string): Promise<number> {
    const response = await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', fixture(name), { filename: name, contentType: 'text/csv' })
      .expect(200)
    return (response.body as { id: number }).id
  }

  // Arma una petición GET autenticada con el token de acceso
  function get(path: string): SupertestTest {
    return request(server).get(path).set('X-Access-Token', token)
  }

  it('returns the legacy no-data envelope', async () => {
    await get('/api/export')
      .expect(404)
      .expect({ detail: 'sin datos: subí un archivo de vigilancia' })
  })

  it('exports the canonical CSV bytes', async () => {
    await upload('demo_624.csv')
    const response = await get('/api/export?format=csv').expect(200)
    expect(response.headers['content-type']).toContain('text/csv')
    expect(response.headers['content-disposition']).toBe('attachment; filename=vigia.csv')
    expect(response.text).toBe(snapshotText('export_demo.csv'))
  })

  it('exports a readable Parquet file', async () => {
    await upload('demo_624.csv')
    const response = await get('/api/export?format=parquet').buffer(true).expect(200)
    const buffer = response.body as Buffer

    expect(response.headers['content-type']).toContain('application/octet-stream')
    expect(response.headers['content-disposition']).toBe('attachment; filename=vigia.parquet')
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('PAR1')

    const reader = await ParquetReader.openBuffer(buffer)
    const cursor = reader.getCursor()
    let count = 0
    let first: Record<string, unknown> | null = null
    for (let row = await cursor.next(); row !== null; row = await cursor.next()) {
      first ??= row
      count += 1
    }
    await reader.close()

    expect(count).toBe(624)
    expect(first?.disease).toBe('DENGUE')
    expect(first?.ubigeo).toBe('160110')
    expect(first?.cases).toBe(18)
  })

  it('scopes the export to one upload', async () => {
    await upload('minsa_dengue_clean.csv')
    const demo = await upload('demo_624.csv')
    const response = await get(`/api/export?format=csv&upload_id=${demo}`).expect(200)
    expect(response.text).toBe(snapshotText('export_demo.csv'))
  })

  it('rejects malformed query values', async () => {
    await upload('demo_624.csv')
    await get('/api/export?upload_id=abc')
      .expect(422)
      .expect({ detail: 'upload_id must be an integer' })
  })
})
