import { readFileSync } from 'node:fs'
import type { Server } from 'node:http'
import { resolve } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request, { type Response } from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { SurveillanceCaseEntity } from '../src/modules/datasets/infrastructure/persistence/surveillance-case.entity'
import { UploadEntity } from '../src/modules/datasets/infrastructure/persistence/upload.entity'
import { loadConfig } from '../src/shared/config/app-config'
import { createDataSource } from '../src/shared/database/data-source'
import { HttpExceptionFilter } from '../src/shared/errors/http-exception.filter'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const token = process.env.VIGIA_ACCESS_TOKEN ?? 'test-token'

function repoRoot(): string {
  let current = process.cwd()
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      readFileSync(resolve(current, 'pnpm-workspace.yaml'))
      return current
    } catch {
      const parent = resolve(current, '..')
      if (parent === current) {
        break
      }
      current = parent
    }
  }
  throw new Error('repository root not found')
}

function snapshot(name: string): unknown {
  return JSON.parse(
    readFileSync(resolve(repoRoot(), 'contract', 'snapshots', name), 'utf8'),
  ) as unknown
}

function fixture(name: string): Buffer {
  const raw = readFileSync(resolve(repoRoot(), 'tests', 'fixtures', name))
  return Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
}

describe.skipIf(!dbEnabled)('ingestion API against PostgreSQL', () => {
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

  it('previews the demo mapping without storing the upload', async () => {
    const response = await request(server)
      .post('/api/upload/preview')
      .set('X-Access-Token', token)
      .attach('file', fixture('demo_624.csv'), {
        filename: 'historico.csv',
        contentType: 'text/csv',
      })
      .expect(200)

    expect(response.body).toEqual(snapshot('api_preview_demo.json'))
    expect(await dataSource.getRepository(UploadEntity).count()).toBe(0)
  })

  it('reports PII columns in the preview and rejects the upload', async () => {
    const csv = Buffer.from(
      'departamento,ano,semana,ubigeo,casos,dni\nLORETO,2024,1,160110,2,12345678\n',
    )

    const preview = await request(server)
      .post('/api/upload/preview')
      .set('X-Access-Token', token)
      .attach('file', csv, { filename: 'pii.csv', contentType: 'text/csv' })
      .expect(200)
    expect(preview.body).toEqual(snapshot('api_preview_pii.json'))

    const upload = await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', csv, { filename: 'pii.csv', contentType: 'text/csv' })
      .expect(422)
    expect(upload.body).toEqual({
      detail: 'Upload contains personal-data columns and was rejected: dni',
    })
    expect(await dataSource.getRepository(UploadEntity).count()).toBe(0)
  })

  it('reports missing required columns without storing the upload', async () => {
    const csv = Buffer.from('departamento,ano,semana,casos\nLORETO,2024,1,2\n')

    const preview = await request(server)
      .post('/api/upload/preview')
      .set('X-Access-Token', token)
      .attach('file', csv, { filename: 'missing.csv', contentType: 'text/csv' })
      .expect(200)
    expect(preview.body).toEqual(snapshot('api_preview_missing_required.json'))

    const upload = await request(server)
      .post('/api/upload')
      .set('X-Access-Token', token)
      .attach('file', csv, { filename: 'missing.csv', contentType: 'text/csv' })
      .expect(422)
    expect(String(upload.body.detail)).toContain('Missing required columns: ubigeo')
  })
})
