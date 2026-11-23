import { Module } from '@nestjs/common'

import { DashboardModule } from '../dashboard/dashboard.module'
import { IdentityModule } from '../identity/identity.module'
import { AnalysisService } from './application/analysis.service'
import { AnalysisRepository } from './infrastructure/analysis.repository'
import { AnalysisController } from './interface/analysis.controller'

@Module({
  imports: [IdentityModule, DashboardModule],
  controllers: [AnalysisController],
  providers: [AnalysisRepository, AnalysisService],
  exports: [AnalysisRepository],
})
export class AnalysisModule {}
