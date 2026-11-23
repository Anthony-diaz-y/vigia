import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { CommonModule } from '../../common/common.module'
import { StorageModule } from '../../common/storage/storage.module'
import { UploadsController } from './controllers/uploads.controller'
import { QualityIssueEntity } from './entities/quality-issue.entity'
import { SurveillanceCaseEntity } from './entities/surveillance-case.entity'
import { UploadEntity } from './entities/upload.entity'
import { DatasetsService } from './services/datasets.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadEntity, QualityIssueEntity, SurveillanceCaseEntity]),
    StorageModule,
    CommonModule,
  ],
  controllers: [UploadsController],
  providers: [DatasetsService],
  exports: [DatasetsService],
})
export class DatasetsModule {}
