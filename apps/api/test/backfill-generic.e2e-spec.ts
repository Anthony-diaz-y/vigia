import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/common/config/app-config'
import { createDataSource } from '../src/common/database/data-source'
import { STORAGE, type StoragePort } from '../src/common/storage/storage.port'
import { backfillGeneric } from '../src/cli/backfill-generic'
import { fixture } from './support'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const token = process.env.VIGIA_ACCESS_TOKEN ?? 'test-token'

describe.skipIf(!dbEnabled)('generic backfill against PostgreSQL', () => {
  let app: INestApplication
  let server: Server
  let dataSource: DataSource
  let storage: StoragePort

  beforeAll(async () => {
    delete process.env.DEEPSEEK_API_KEY
    dataSource = createDataSource(loadConfig())
    await dataSource.initialize()
    await dataSource.runMigrations()

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
    server = app.getHttpServer() as Server
    storage = app.get<StoragePort>(STORAGE)
  })

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "uploads" RESTART IDENTITY CASCADE')
  })

  afterAll(async () => {
    await app?.close()
    await dataSource?.destroy()
  })

  it('rellena una carga antigua sin columnas', async () => {
    await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', fixture('demo_624.csv'), {
        filename: 'historico.csv',
        contentType: 'text/csv',
      })
      .expect(200)
    await dataSource.query(`UPDATE "uploads" SET columns = '[]', title = '', topic = ''`)
    await dataSource.query('DELETE FROM "dataset_rows"')

    expect(await backfillGeneric(dataSource, storage)).toBe(1)

    const [upload] = await dataSource.query<
      Array<{ title: string; topic: string; columns: Array<{ name: string; role: string }> }>
    >('SELECT title, topic, columns FROM "uploads"')
    expect(upload?.title).toBe('historico')
    expect(upload?.topic).toBe('dengue')
    expect(upload?.columns).toHaveLength(13)
    expect(upload?.columns.find((column) => column.name === 'casos')?.role).toBe('count')
    const [rows] = await dataSource.query<Array<{ total: string }>>(
      'SELECT COUNT(*) AS total FROM "dataset_rows"',
    )
    expect(Number(rows?.total)).toBe(624)

    expect(await backfillGeneric(dataSource, storage)).toBe(0)
  })
})
