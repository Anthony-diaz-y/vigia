import { Module } from '@nestjs/common'

import { AppConfigModule } from './shared/config/app-config'
import { DatabaseModule } from './shared/database/database.module'
import { AnalysisModule } from './modules/analysis/analysis.module'
import { DatasetsModule } from './modules/datasets/datasets.module'
import { ForecastingModule } from './modules/forecasting/forecasting.module'
import { HealthModule } from './modules/health/health.module'
import { IngestionModule } from './modules/ingestion/ingestion.module'

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    AnalysisModule,
    DatasetsModule,
    IngestionModule,
    ForecastingModule,
  ],
})
export class AppModule {}
