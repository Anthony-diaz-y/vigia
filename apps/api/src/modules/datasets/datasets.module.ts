import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { IdentityModule } from '../identity/identity.module'
import { StorageModule } from '../../shared/storage/storage.module'
import { DatasetsService } from './application/datasets.service'
import { QualityIssueEntity } from './infrastructure/persistence/quality-issue.entity'
import { SurveillanceCaseEntity } from './infrastructure/persistence/surveillance-case.entity'
import { UploadEntity } from './infrastructure/persistence/upload.entity'
import { UploadsController } from './interface/uploads.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadEntity, QualityIssueEntity, SurveillanceCaseEntity]),
    StorageModule,
    IdentityModule,
  ],
  controllers: [UploadsController],
  providers: [DatasetsService],
  exports: [DatasetsService],
})
export class DatasetsModule {}
