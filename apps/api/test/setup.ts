import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll } from 'vitest'

import { resolveTestDatabase } from './database-url'

// Sin base configurada basta una URL válida, porque las pruebas unitarias no la usan
const testDatabaseUrl =
  resolveTestDatabase()?.url ?? 'postgresql://localhost:5432/vigia_unconfigured_test'
const dataDir = mkdtempSync(join(tmpdir(), 'vigia-api-test-'))

process.env.NODE_ENV = 'test'
process.env.VIGIA_AUTH_SECRET = 'test-secret-for-signing-sessions'
process.env.VIGIA_ADMIN_PASSWORD = 'test-admin-password'
process.env.VIGIA_DATABASE_URL = testDatabaseUrl
process.env.VIGIA_TS_DATABASE_URL = testDatabaseUrl
process.env.VIGIA_DATA_DIR = dataDir
process.env.VIGIA_CORS_ORIGINS = 'http://localhost:3000'
delete process.env.DEEPSEEK_API_KEY

// Borra la carpeta temporal de archivos al terminar cada archivo de pruebas
afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true })
})
