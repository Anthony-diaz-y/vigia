import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'

import { normalizeDatabaseUrl } from '../src/common/config/app-config'

const ENV_FILES = ['.env', '../../.env']
const TEST_DATABASE_NAME = /^[a-z0-9_]+_test$/

export interface TestDatabase {
  url: string
  name: string
  // URL de la base de mantenimiento del mismo servidor, para crear y borrar la de pruebas
  maintenanceUrl: string
}

// Lee VIGIA_DATABASE_URL del entorno o del primer .env que exista, sin cargar el resto
function appDatabaseUrl(): string | undefined {
  if (process.env.VIGIA_DATABASE_URL) {
    return process.env.VIGIA_DATABASE_URL
  }
  for (const path of ENV_FILES) {
    const candidate = resolve(path)
    if (existsSync(candidate)) {
      return parseEnv(readFileSync(candidate, 'utf8')).VIGIA_DATABASE_URL
    }
  }
  return undefined
}

// Resuelve la base temporal de pruebas y exige el sufijo _test para no vaciar la de la app
export function resolveTestDatabase(): TestDatabase | null {
  const explicit = process.env.VIGIA_TEST_DATABASE_URL
  const base = explicit ?? appDatabaseUrl()
  if (!base) {
    return null
  }
  const url = new URL(normalizeDatabaseUrl(base))
  const appName = decodeURIComponent(url.pathname.slice(1))
  if (!explicit) {
    url.pathname = `/${appName}_test`
  }
  const name = decodeURIComponent(url.pathname.slice(1))
  if (!TEST_DATABASE_NAME.test(name) || (!explicit && name === appName)) {
    throw new Error(`refusing to use "${name}" as the e2e database: its name must end in _test`)
  }
  const maintenance = new URL(url)
  maintenance.pathname = '/postgres'
  return { url: url.toString(), name, maintenanceUrl: maintenance.toString() }
}
