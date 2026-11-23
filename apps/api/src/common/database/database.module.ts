import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { APP_CONFIG, type AppConfig } from '../config/app-config'
import { entities } from './data-source'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        type: 'postgres' as const,
        url: config.databaseUrl,
        entities,
        synchronize: false,
        migrationsRun: false,
        logging: false,
        ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
        extra: {
          max: 10,
          application_name: 'vigia-api',
        },
        retryAttempts: 3,
        retryDelay: 1_000,
      }),
    }),
  ],
})
export class DatabaseModule {}
