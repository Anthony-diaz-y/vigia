import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveTestDatabase } from './database-url'

describe('resolveTestDatabase', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('agrega el sufijo _test a la base de la app', () => {
    vi.stubEnv('VIGIA_TEST_DATABASE_URL', undefined)
    vi.stubEnv('VIGIA_DATABASE_URL', 'postgresql://app:s3cr%40t@localhost:55432/vigia')
    expect(resolveTestDatabase()).toEqual({
      url: 'postgresql://app:s3cr%40t@localhost:55432/vigia_test',
      name: 'vigia_test',
      maintenanceUrl: 'postgresql://app:s3cr%40t@localhost:55432/postgres',
    })
  })

  it('usa tal cual una VIGIA_TEST_DATABASE_URL explícita', () => {
    vi.stubEnv('VIGIA_TEST_DATABASE_URL', 'postgresql://ci:ci@localhost:5432/vigia_test')
    expect(resolveTestDatabase()?.url).toBe('postgresql://ci:ci@localhost:5432/vigia_test')
  })

  it('se niega a usar una base cuyo nombre no termina en _test', () => {
    vi.stubEnv('VIGIA_TEST_DATABASE_URL', 'postgresql://ci:ci@localhost:5432/vigia')
    expect(() => resolveTestDatabase()).toThrow(/must end in _test/)
    vi.stubEnv('VIGIA_TEST_DATABASE_URL', 'postgresql://ci:ci@localhost:5432/x_test";DROP')
    expect(() => resolveTestDatabase()).toThrow(/must end in _test/)
  })
})
