import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_AUTH_SECRET,
  LEGACY_ADMIN_PASSWORD,
  loadConfig,
  normalizeDatabaseUrl,
} from './app-config'

const REQUIRED = {
  VIGIA_DATABASE_URL: 'postgresql://app:secret@localhost:55432/vigia',
  VIGIA_ADMIN_PASSWORD: 'a-real-admin-password',
}

describe('loadConfig', () => {
  it('normalizes the SQLAlchemy Postgres URL and parses CORS origins', () => {
    const config = loadConfig({
      ...REQUIRED,
      NODE_ENV: 'test',
      PORT: '4000',
      VIGIA_DATABASE_URL: 'postgresql+psycopg://vigia:vigia@db:5432/vigia',
      VIGIA_DATA_DIR: './var/data',
      VIGIA_CORS_ORIGINS: 'http://localhost:3000, https://vigia.example',
    })

    expect(config.port).toBe(4000)
    expect(config.databaseUrl).toBe('postgresql://vigia:vigia@db:5432/vigia')
    expect(config.dataDir).toBe(resolve('./var/data'))
    expect(config.corsOrigins).toEqual(['http://localhost:3000', 'https://vigia.example'])
    expect(config.databaseSsl).toBe(false)
  })

  it('prefers the explicit VIGIA_TS_DATABASE_URL override', () => {
    const config = loadConfig({
      ...REQUIRED,
      NODE_ENV: 'test',
      VIGIA_DATABASE_URL: 'postgresql+psycopg://vigia:vigia@localhost:55432/vigia',
      VIGIA_TS_DATABASE_URL: 'postgresql://vigia:vigia@localhost:55432/vigia_ts',
    })

    expect(config.databaseUrl).toBe('postgresql://vigia:vigia@localhost:55432/vigia_ts')
  })

  it('rejects the development defaults in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        VIGIA_AUTH_SECRET: DEFAULT_AUTH_SECRET,
        VIGIA_ADMIN_PASSWORD: LEGACY_ADMIN_PASSWORD,
        VIGIA_DATABASE_URL: REQUIRED.VIGIA_DATABASE_URL,
      }),
    ).toThrow(/VIGIA_AUTH_SECRET.*VIGIA_ADMIN_PASSWORD/)
  })

  it('rejects the .env.example placeholders in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        VIGIA_AUTH_SECRET: 'change-me-to-a-random-value-of-at-least-32-characters',
        VIGIA_ADMIN_PASSWORD: 'change-me',
        VIGIA_DATABASE_URL: 'postgresql://vigia_app:change-me@localhost:55432/vigia',
      }),
    ).toThrow(/VIGIA_AUTH_SECRET.*VIGIA_ADMIN_PASSWORD.*VIGIA_DATABASE_URL/s)
  })

  it('rejects a short signing secret in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        VIGIA_AUTH_SECRET: 'only-sixteen-chars',
        VIGIA_ADMIN_PASSWORD: 'a-real-admin-password',
        VIGIA_DATABASE_URL: 'postgresql://vigia:secret@db.internal:5432/vigia',
      }),
    ).toThrow(/VIGIA_AUTH_SECRET/)
  })

  it('reads the session length and the first administrator', () => {
    const config = loadConfig({
      ...REQUIRED,
      NODE_ENV: 'test',
      VIGIA_SESSION_HOURS: '8',
      VIGIA_ADMIN_EMAIL: 'Jefa@Diresa.gob.pe',
      VIGIA_ADMIN_NAME: 'Jefa de epidemiología',
    })

    expect(config.auth.sessionSeconds).toBe(8 * 3600)
    expect(config.auth.admin).toMatchObject({
      email: 'jefa@diresa.gob.pe',
      name: 'Jefa de epidemiología',
    })
  })

  it('accepts explicit production secrets', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      VIGIA_AUTH_SECRET: 'a-random-production-secret-with-40-chars!!',
      VIGIA_ADMIN_PASSWORD: 'a-real-admin-password',
      VIGIA_DATABASE_URL: 'postgresql://vigia:secret@db.internal:5432/vigia',
      VIGIA_DATABASE_SSL: 'true',
    })

    expect(config.nodeEnv).toBe('production')
    expect(config.databaseSsl).toBe(true)
  })

  it('requires the database URL', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'test', VIGIA_ADMIN_PASSWORD: REQUIRED.VIGIA_ADMIN_PASSWORD }),
    ).toThrow(/VIGIA_DATABASE_URL/)
    expect(() => loadConfig({ ...REQUIRED, NODE_ENV: 'test', VIGIA_DATABASE_URL: '' })).toThrow(
      /VIGIA_DATABASE_URL/,
    )
  })

  it('loads without an administrator password, as the migration CLI needs', () => {
    const config = loadConfig({ NODE_ENV: 'test', VIGIA_DATABASE_URL: REQUIRED.VIGIA_DATABASE_URL })
    expect(config.auth.admin.password).toBeUndefined()
    expect(() =>
      loadConfig({ ...REQUIRED, NODE_ENV: 'test', VIGIA_ADMIN_PASSWORD: 'short' }),
    ).toThrow(/VIGIA_ADMIN_PASSWORD/)
  })

  it('rejects an invalid port', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        ...REQUIRED,
        PORT: 'not-a-port',
        VIGIA_DATABASE_URL: 'postgresql://localhost/vigia',
      }),
    ).toThrow(/PORT/)
  })
})

describe('normalizeDatabaseUrl', () => {
  it('leaves ordinary Postgres URLs untouched', () => {
    expect(normalizeDatabaseUrl('postgresql://u:p@h:5432/db')).toBe('postgresql://u:p@h:5432/db')
    expect(normalizeDatabaseUrl('postgres://u:p@h:5432/db')).toBe('postgres://u:p@h:5432/db')
  })

  it('translates both psycopg prefixes', () => {
    expect(normalizeDatabaseUrl('postgresql+psycopg://u:p@h/db')).toBe('postgresql://u:p@h/db')
    expect(normalizeDatabaseUrl('postgres+psycopg://u:p@h/db')).toBe('postgres://u:p@h/db')
  })
})
