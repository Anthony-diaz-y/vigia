import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'

import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { z } from 'zod'

export const DEFAULT_ACCESS_TOKEN = 'vigia-dev'
export const DEFAULT_DATABASE_URL = 'postgresql://vigia:vigia@localhost:55432/vigia'

export const APP_CONFIG = Symbol('APP_CONFIG')

const rawSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    VIGIA_ACCESS_TOKEN: z.string().min(1).default(DEFAULT_ACCESS_TOKEN),
    VIGIA_DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
    VIGIA_TS_DATABASE_URL: z.string().min(1).optional(),
    VIGIA_DATA_DIR: z.string().min(1).default('data'),
    VIGIA_CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
    VIGIA_DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  })
  .superRefine((raw, context) => {
    if (raw.NODE_ENV !== 'production') {
      return
    }
    if (raw.VIGIA_ACCESS_TOKEN === DEFAULT_ACCESS_TOKEN) {
      context.addIssue({
        code: 'custom',
        path: ['VIGIA_ACCESS_TOKEN'],
        message: 'set a non-default VIGIA_ACCESS_TOKEN in production',
      })
    }
    if ((raw.VIGIA_TS_DATABASE_URL ?? raw.VIGIA_DATABASE_URL) === DEFAULT_DATABASE_URL) {
      context.addIssue({
        code: 'custom',
        path: ['VIGIA_DATABASE_URL'],
        message: 'set the production VIGIA_TS_DATABASE_URL',
      })
    }
  })

export const appConfigSchema = rawSchema.transform((raw) => ({
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,
  accessToken: raw.VIGIA_ACCESS_TOKEN,
  databaseUrl: normalizeDatabaseUrl(raw.VIGIA_TS_DATABASE_URL ?? raw.VIGIA_DATABASE_URL),
  dataDir: resolve(raw.VIGIA_DATA_DIR),
  corsOrigins: raw.VIGIA_CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  databaseSsl: raw.VIGIA_DATABASE_SSL === 'true',
}))

export type AppConfig = z.output<typeof appConfigSchema>

/**
 * Load the first existing `.env` file. `Nest`'s ConfigModule does this for the
 * server, but standalone scripts (migrations) do not boot Nest.
 */
export function loadEnvFiles(paths: readonly string[] = ['.env', '../../.env']): void {
  for (const path of paths) {
    const candidate = resolve(path)
    if (existsSync(candidate)) {
      loadEnvFile(candidate)
      return
    }
  }
}

/** Translate the SQLAlchemy-style URL used by the Python service to a `pg` URL. */
export function normalizeDatabaseUrl(url: string): string {
  return url
    .replace(/^postgresql\+psycopg:\/\//, 'postgresql://')
    .replace(/^postgres\+psycopg:\/\//, 'postgres://')
}

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

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      load: [() => ({ app: loadConfig() })],
    }),
  ],
  providers: [
    {
      provide: APP_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getOrThrow<AppConfig>('app'),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
