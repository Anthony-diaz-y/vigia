import { Module } from '@nestjs/common'

import { AnalysisModule } from '../analysis/analysis.module'
import { ForecastingModule } from '../forecasting/forecasting.module'
import { IdentityModule } from '../identity/identity.module'
import { RecommendationsService } from './application/recommendations.service'
import { ActionAdvisor } from './infrastructure/action-advisor'
import { RecommendationsController } from './interface/recommendations.controller'

@Module({
  imports: [AnalysisModule, ForecastingModule, IdentityModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, ActionAdvisor],
})
export class RecommendationsModule {}
