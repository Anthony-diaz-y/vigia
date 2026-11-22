import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DISCLAIMER } from '@vigia/contracts'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/shared/config/app-config'
import { createDataSource } from '../src/shared/database/data-source'
import { HttpExceptionFilter } from '../src/shared/errors/http-exception.filter'
import { QualityIssueEntity } from '../src/modules/datasets/infrastructure/persistence/quality-issue.entity'
import { UploadEntity } from '../src/modules/datasets/infrastructure/persistence/upload.entity'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const token = process.env.VIGIA_ACCESS_TOKEN ?? 'test-token'

describe.skipIf(!dbEnabled)('uploads API against PostgreSQL', () => {
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

  // Inserta directamente una carga de prueba en la base de datos
  async function seedUpload(suffix = 'a'): Promise<UploadEntity> {
    const repository = dataSource.getRepository(UploadEntity)
    return repository.save(
      repository.create({
        fileHash: suffix.repeat(64),
        filename: `historico-${suffix}.csv`,
        source: 'minsa_dengue',
        status: suffix === 'b' ? 'ok_with_issues' : 'ok',
        rowsIn: 100,
        rowsValid: 90,
        rowsDropped: 5,
        duplicatesCollapsed: 5,
        mapping: { department: 'departamento', cases: 'casos' },
        unmappedColumns: ['dni'],
        sourceFormat: 'csv',
        encoding: 'utf-8-sig',
        delimiter: ',',
        rawStorageKey: `raw/${suffix}`,
        normalizedStorageKey: null,
        qualityStorageKey: `uploads/${suffix}/quality.json`,
      }),
    )
  }

  it('serves health without a token', async () => {
    const response = await request(server).get('/api/health').expect(200)
    expect(response.body).toEqual({ status: 'ok', disclaimer: DISCLAIMER })
  })

  it('rejects uploads without a token using the FastAPI envelope', async () => {
    const response = await request(server).get('/api/uploads').expect(401)
    expect(response.body).toEqual({ detail: 'token de acceso inválido o ausente' })
  })

  it('lists uploads newest first', async () => {
    await seedUpload('a')
    await seedUpload('b')

    const response = await request(server)
      .get('/api/uploads')
      .set('X-Access-Token', token)
      .expect(200)

    expect(response.body).toHaveLength(2)
    expect(response.body[0].id).toBe(2)
    expect(response.body[1].id).toBe(1)
    expect(response.body[0].status).toBe('ok_with_issues')
    expect(response.body[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(response.body[0].rows_in).toBe(100)
  })

  it('reconstructs the quality report with issue order preserved', async () => {
    const upload = await seedUpload('a')
    const issues = dataSource.getRepository(QualityIssueEntity)
    await issues.save([
      issues.create({
        uploadId: upload.id,
        position: 2,
        code: 'missing_cases',
        message: 'Row has no case count.',
        count: 2,
        sample: ['x', 'y'],
      }),
      issues.create({
        uploadId: upload.id,
        position: 1,
        code: 'invalid_ubigeo',
        message: 'UBIGEO is not a 6-digit code.',
        count: 1,
        sample: ['12'],
      }),
    ])

    const response = await request(server)
      .get(`/api/uploads/${upload.id}/quality`)
      .set('X-Access-Token', token)
      .expect(200)

    expect(response.body).toMatchObject({
      rows_in: 100,
      rows_valid: 90,
      rows_dropped: 5,
      duplicates_collapsed: 5,
      mapped_columns: { department: 'departamento', cases: 'casos' },
      unmapped_columns: ['dni'],
      source_format: 'csv',
      encoding: 'utf-8-sig',
      delimiter: ',',
      file_hash: upload.fileHash,
    })
    expect(response.body.issues.map((issue: { code: string }) => issue.code)).toEqual([
      'invalid_ubigeo',
      'missing_cases',
    ])
  })

  it('returns a FastAPI-shaped 404 for an unknown upload', async () => {
    const response = await request(server)
      .get('/api/uploads/999/quality')
      .set('X-Access-Token', token)
      .expect(404)
    expect(response.body).toEqual({ detail: 'carga no encontrada' })
  })

  it('returns 422 for a non-numeric upload id', async () => {
    const response = await request(server)
      .get('/api/uploads/not-a-number/quality')
      .set('X-Access-Token', token)
      .expect(422)
    expect(typeof response.body.detail).toBe('string')
  })

  it('clears uploads and resets identity', async () => {
    await seedUpload('a')

    const response = await request(server)
      .delete('/api/uploads')
      .set('X-Access-Token', token)
      .expect(200)
    expect(response.body).toEqual({ cleared: true })

    const list = await request(server).get('/api/uploads').set('X-Access-Token', token).expect(200)
    expect(list.body).toEqual([])

    const next = await seedUpload('b')
    expect(next.id).toBe(1)
  })
})
