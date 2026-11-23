import { Module } from '@nestjs/common'

import { IdentityModule } from '../identity/identity.module'
import { DashboardService } from './application/dashboard.service'
import { IndicatorForecastService } from './application/indicator-forecast.service'
import { DashboardRepository } from './infrastructure/dashboard.repository'
import { DashboardController } from './interface/dashboard.controller'

@Module({
  imports: [IdentityModule],
  controllers: [DashboardController],
  providers: [DashboardService, IndicatorForecastService, DashboardRepository],
  exports: [DashboardRepository],
})
export class DashboardModule {}
