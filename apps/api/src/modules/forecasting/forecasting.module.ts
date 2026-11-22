import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AnalysisModule } from '../analysis/analysis.module'
import { IdentityModule } from '../identity/identity.module'
import { ForecastingService } from './application/forecasting.service'
import { ModelRegistryRepository } from './infrastructure/model-registry.repository'
import { ModelRegistryEntity } from './infrastructure/persistence/model-registry.entity'
import { ForecastingController } from './interface/forecasting.controller'

@Module({
  imports: [TypeOrmModule.forFeature([ModelRegistryEntity]), AnalysisModule, IdentityModule],
  controllers: [ForecastingController],
  providers: [ModelRegistryRepository, ForecastingService],
  exports: [ForecastingService],
})
export class ForecastingModule {}
