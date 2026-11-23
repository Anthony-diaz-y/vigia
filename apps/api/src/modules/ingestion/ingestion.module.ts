import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { CommonModule } from '../../common/common.module'
import { StorageModule } from '../../common/storage/storage.module'
import { QualityIssueEntity } from '../datasets/entities/quality-issue.entity'
import { SurveillanceCaseEntity } from '../datasets/entities/surveillance-case.entity'
import { UploadEntity } from '../datasets/entities/upload.entity'
import { IngestionController } from './controllers/ingestion.controller'
import { ColumnAdvisor } from './services/column-advisor'
import { IngestionService } from './services/ingestion.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadEntity, QualityIssueEntity, SurveillanceCaseEntity]),
    StorageModule,
    CommonModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService, ColumnAdvisor],
})
export class IngestionModule {}
