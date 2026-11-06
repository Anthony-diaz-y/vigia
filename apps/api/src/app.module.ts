import { Module } from '@nestjs/common'

import { AppConfigModule } from './shared/config/app-config'
import { DatabaseModule } from './shared/database/database.module'
import { DatasetsModule } from './modules/datasets/datasets.module'
import { ForecastingModule } from './modules/forecasting/forecasting.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, DatasetsModule, ForecastingModule],
})
export class AppModule {}
