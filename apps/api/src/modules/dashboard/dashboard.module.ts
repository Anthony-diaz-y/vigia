import { Module } from '@nestjs/common'

import { CommonModule } from '../../common/common.module'
import { DashboardController } from './controllers/dashboard.controller'
import { DashboardRepository } from './repositories/dashboard.repository'
import { DashboardService } from './services/dashboard.service'
import { IndicatorForecastService } from './services/indicator-forecast.service'

@Module({
  imports: [CommonModule],
  controllers: [DashboardController],
  providers: [DashboardService, IndicatorForecastService, DashboardRepository],
  exports: [DashboardRepository],
})
export class DashboardModule {}
