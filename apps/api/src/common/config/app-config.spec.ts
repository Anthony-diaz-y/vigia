import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ACCESS_TOKEN,
  DEFAULT_DATABASE_URL,
  loadConfig,
  normalizeDatabaseUrl,
} from './app-config'

describe('loadConfig', () => {
  it('normalizes the SQLAlchemy Postgres URL and parses CORS origins', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '4000',
      VIGIA_ACCESS_TOKEN: 'secret-token',
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
      NODE_ENV: 'test',
      VIGIA_ACCESS_TOKEN: 'secret-token',
      VIGIA_DATABASE_URL: 'postgresql+psycopg://vigia:vigia@localhost:55432/vigia',
      VIGIA_TS_DATABASE_URL: 'postgresql://vigia:vigia@localhost:55432/vigia_ts',
    })

    expect(config.databaseUrl).toBe('postgresql://vigia:vigia@localhost:55432/vigia_ts')
  })

  it('rejects the development defaults in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        VIGIA_ACCESS_TOKEN: DEFAULT_ACCESS_TOKEN,
        VIGIA_DATABASE_URL: DEFAULT_DATABASE_URL,
      }),
    ).toThrow(/VIGIA_ACCESS_TOKEN/)
  })

  it('accepts explicit production secrets', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      VIGIA_ACCESS_TOKEN: 'a-real-production-token',
      VIGIA_DATABASE_URL: 'postgresql://vigia:secret@db.internal:5432/vigia',
      VIGIA_DATABASE_SSL: 'true',
    })

    expect(config.nodeEnv).toBe('production')
    expect(config.databaseSsl).toBe(true)
  })

  it('rejects an invalid port', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'test',
        PORT: 'not-a-port',
        VIGIA_ACCESS_TOKEN: 'secret-token',
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
