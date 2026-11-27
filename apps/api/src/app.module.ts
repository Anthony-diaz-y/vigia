import { Module } from '@nestjs/common'

import { AppConfigModule } from './common/config/app-config.module'
import { DatabaseModule } from './common/database/database.module'
import { LlmModule } from './common/llm/llm.module'
import { AnalysisModule } from './modules/analysis/analysis.module'
import { AuthModule } from './modules/auth/auth.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { DatasetsModule } from './modules/datasets/datasets.module'
import { ExplanationModule } from './modules/explanation/explanation.module'
import { ExportModule } from './modules/export/export.module'
import { ForecastingModule } from './modules/forecasting/forecasting.module'
import { HealthModule } from './modules/health/health.module'
import { IngestionModule } from './modules/ingestion/ingestion.module'
import { RecommendationsModule } from './modules/recommendations/recommendations.module'
import { UsersModule } from './modules/users/users.module'

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    LlmModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AnalysisModule,
    DatasetsModule,
    IngestionModule,
    ForecastingModule,
    ExplanationModule,
    ExportModule,
    RecommendationsModule,
    DashboardModule,
  ],
})
export class AppModule {}
