import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'

import { z } from 'zod'

export const DEFAULT_AUTH_SECRET = 'vigia-dev-secret-change-me-in-production'
// Contraseña que la app traía por defecto; se rechaza en producción si alguien la vuelve a usar
export const LEGACY_ADMIN_PASSWORD = 'vigia-admin'
const MIN_PRODUCTION_SECRET = 32
const PLACEHOLDER = /change-me/i

export const APP_CONFIG = Symbol('APP_CONFIG')

const rawSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    VIGIA_AUTH_SECRET: z.string().min(16).default(DEFAULT_AUTH_SECRET),
    VIGIA_SESSION_HOURS: z.coerce.number().int().min(1).max(720).default(12),
    VIGIA_ADMIN_EMAIL: z.string().email().default('admin@vigia.local'),
    VIGIA_ADMIN_NAME: z.string().min(1).max(80).default('Administrador'),
    // Opcional para los CLI; la API la exige al crear el primer administrador
    VIGIA_ADMIN_PASSWORD: z.string().min(8).optional(),
    VIGIA_DATABASE_URL: z.string({ error: 'is required' }).min(1, 'is required'),
    VIGIA_TS_DATABASE_URL: z.string().min(1).optional(),
    VIGIA_DATA_DIR: z.string().min(1).default('data'),
    VIGIA_CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
    VIGIA_DATABASE_SSL: z.enum(['true', 'false']).default('false'),
    DEEPSEEK_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((raw, context) => {
    if (raw.NODE_ENV !== 'production') {
      return
    }
    if (
      raw.VIGIA_AUTH_SECRET === DEFAULT_AUTH_SECRET ||
      raw.VIGIA_AUTH_SECRET.length < MIN_PRODUCTION_SECRET ||
      PLACEHOLDER.test(raw.VIGIA_AUTH_SECRET)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['VIGIA_AUTH_SECRET'],
        message: `set a random VIGIA_AUTH_SECRET of at least ${MIN_PRODUCTION_SECRET} characters in production`,
      })
    }
    const adminPassword = raw.VIGIA_ADMIN_PASSWORD
    if (
      adminPassword === LEGACY_ADMIN_PASSWORD ||
      (adminPassword && PLACEHOLDER.test(adminPassword))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['VIGIA_ADMIN_PASSWORD'],
        message: 'set a non-default VIGIA_ADMIN_PASSWORD in production',
      })
    }
    if (PLACEHOLDER.test(raw.VIGIA_TS_DATABASE_URL ?? raw.VIGIA_DATABASE_URL)) {
      context.addIssue({
        code: 'custom',
        path: ['VIGIA_DATABASE_URL'],
        message: 'replace the change-me password of VIGIA_DATABASE_URL in production',
      })
    }
  })

export const appConfigSchema = rawSchema.transform((raw) => ({
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,
  auth: {
    secret: raw.VIGIA_AUTH_SECRET,
    sessionSeconds: raw.VIGIA_SESSION_HOURS * 3600,
    admin: {
      email: raw.VIGIA_ADMIN_EMAIL.toLowerCase(),
      name: raw.VIGIA_ADMIN_NAME,
      password: raw.VIGIA_ADMIN_PASSWORD,
    },
  },
  databaseUrl: normalizeDatabaseUrl(raw.VIGIA_TS_DATABASE_URL ?? raw.VIGIA_DATABASE_URL),
  dataDir: resolve(raw.VIGIA_DATA_DIR),
  corsOrigins: raw.VIGIA_CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  databaseSsl: raw.VIGIA_DATABASE_SSL === 'true',
  deepseekApiKey: raw.DEEPSEEK_API_KEY,
}))

export type AppConfig = z.output<typeof appConfigSchema>

// Carga el primer archivo .env que exista, para scripts que no arrancan Nest
export function loadEnvFiles(paths: readonly string[] = ['.env', '../../.env']): void {
  for (const path of paths) {
    const candidate = resolve(path)
    if (existsSync(candidate)) {
      loadEnvFile(candidate)
      return
    }
  }
}

// Convierte una URL de base de datos estilo SQLAlchemy en una URL válida para pg
export function normalizeDatabaseUrl(url: string): string {
  return url
    .replace(/^postgresql\+psycopg:\/\//, 'postgresql://')
    .replace(/^postgres\+psycopg:\/\//, 'postgres://')
}

// Valida las variables de entorno y devuelve la configuración de la app
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = appConfigSchema.safeParse(env)
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ')
    throw new Error(`invalid configuration: ${detail}`)
  }
  return result.data
}
