import { Module } from '@nestjs/common'

import { CommonModule } from '../../common/common.module'
import { DashboardModule } from '../dashboard/dashboard.module'
import { AnalysisController } from './controllers/analysis.controller'
import { AnalysisRepository } from './repositories/analysis.repository'
import { AnalysisService } from './services/analysis.service'

@Module({
  imports: [CommonModule, DashboardModule],
  controllers: [AnalysisController],
  providers: [AnalysisRepository, AnalysisService],
  exports: [AnalysisRepository],
})
export class AnalysisModule {}
