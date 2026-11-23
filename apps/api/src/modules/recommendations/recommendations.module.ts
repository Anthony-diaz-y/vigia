import { Module } from '@nestjs/common'

import { AnalysisModule } from '../analysis/analysis.module'
import { CommonModule } from '../../common/common.module'
import { ForecastingModule } from '../forecasting/forecasting.module'
import { RecommendationsController } from './controllers/recommendations.controller'
import { ActionAdvisor } from './services/action-advisor'
import { RecommendationsService } from './services/recommendations.service'

@Module({
  imports: [AnalysisModule, ForecastingModule, CommonModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, ActionAdvisor],
})
export class RecommendationsModule {}
