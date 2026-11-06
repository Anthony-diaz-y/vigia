import { DataSource } from 'typeorm'

import type { AppConfig } from '../config/app-config'
import { SurveillanceCaseEntity } from '../../modules/datasets/infrastructure/persistence/surveillance-case.entity'
import { QualityIssueEntity } from '../../modules/datasets/infrastructure/persistence/quality-issue.entity'
import { UploadEntity } from '../../modules/datasets/infrastructure/persistence/upload.entity'
import { ModelRegistryEntity } from '../../modules/forecasting/infrastructure/persistence/model-registry.entity'
import { migrations } from './migrations'

export const entities = [
  UploadEntity,
  QualityIssueEntity,
  SurveillanceCaseEntity,
  ModelRegistryEntity,
]

export function createDataSource(config: AppConfig): DataSource {
  return new DataSource({
    type: 'postgres',
    url: config.databaseUrl,
    entities,
    migrations,
    synchronize: false,
    migrationsRun: false,
    logging: false,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
    extra: {
      max: 10,
      application_name: 'vigia-api',
    },
  })
}
