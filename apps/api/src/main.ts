import 'reflect-metadata'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'

import { AppModule } from './app.module'
import { APP_CONFIG, type AppConfig } from './shared/config/app-config'
import { HttpExceptionFilter } from './shared/errors/http-exception.filter'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = app.get<AppConfig>(APP_CONFIG)

  app.setGlobalPrefix('api')
  app.useGlobalFilters(new HttpExceptionFilter())
  app.use(helmet())
  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Token'],
  })
  app.enableShutdownHooks()
  app.getHttpAdapter().getInstance().disable('x-powered-by')

  await app.listen(config.port)
  Logger.log(`Vigia API listening on port ${config.port}`, 'Bootstrap')
}

void bootstrap().catch((error: unknown) => {
  Logger.error('Failed to start the Vigia API', error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
