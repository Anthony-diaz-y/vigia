import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.NODE_ENV = 'test'
process.env.VIGIA_AUTH_SECRET = 'test-secret-for-signing-sessions'
process.env.VIGIA_ADMIN_PASSWORD = 'test-admin-password'
const testDatabaseUrl =
  process.env.VIGIA_TEST_DATABASE_URL ?? 'postgresql://vigia:vigia@localhost:55432/vigia_test'
process.env.VIGIA_DATABASE_URL = testDatabaseUrl
process.env.VIGIA_TS_DATABASE_URL = testDatabaseUrl
process.env.VIGIA_DATA_DIR = mkdtempSync(join(tmpdir(), 'vigia-api-test-'))
process.env.VIGIA_CORS_ORIGINS = 'http://localhost:3000'
