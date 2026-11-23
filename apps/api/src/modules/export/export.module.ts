import { Module } from '@nestjs/common'

import { AnalysisModule } from '../analysis/analysis.module'
import { CommonModule } from '../../common/common.module'
import { ExportController } from './controllers/export.controller'
import { ExportService } from './services/export.service'

@Module({
  imports: [AnalysisModule, CommonModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
