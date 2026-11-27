import { DataSource } from 'typeorm'

import type { AppConfig } from '../config/app-config'
import { DatasetRowEntity } from '../../modules/datasets/entities/dataset-row.entity'
import { SurveillanceCaseEntity } from '../../modules/datasets/entities/surveillance-case.entity'
import { QualityIssueEntity } from '../../modules/datasets/entities/quality-issue.entity'
import { UploadEntity } from '../../modules/datasets/entities/upload.entity'
import { ModelRegistryEntity } from '../../modules/forecasting/entities/model-registry.entity'
import { UserEntity } from '../../modules/users/entities/user.entity'
import { migrations } from './migrations'

export const entities = [
  UploadEntity,
  QualityIssueEntity,
  SurveillanceCaseEntity,
  DatasetRowEntity,
  ModelRegistryEntity,
  UserEntity,
]

// Crea el DataSource de TypeORM para PostgreSQL con entidades y migraciones
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
