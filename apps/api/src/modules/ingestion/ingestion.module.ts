import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { IdentityModule } from '../identity/identity.module'
import { StorageModule } from '../../shared/storage/storage.module'
import { QualityIssueEntity } from '../datasets/infrastructure/persistence/quality-issue.entity'
import { SurveillanceCaseEntity } from '../datasets/infrastructure/persistence/surveillance-case.entity'
import { UploadEntity } from '../datasets/infrastructure/persistence/upload.entity'
import { IngestionService } from './application/ingestion.service'
import { IngestionController } from './interface/ingestion.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadEntity, QualityIssueEntity, SurveillanceCaseEntity]),
    StorageModule,
    IdentityModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
