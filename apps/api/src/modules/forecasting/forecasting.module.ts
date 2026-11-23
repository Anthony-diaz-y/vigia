import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AnalysisModule } from '../analysis/analysis.module'
import { CommonModule } from '../../common/common.module'
import { ForecastingController } from './controllers/forecasting.controller'
import { ModelRegistryEntity } from './entities/model-registry.entity'
import { ModelRegistryRepository } from './repositories/model-registry.repository'
import { ForecastingService } from './services/forecasting.service'

@Module({
  imports: [TypeOrmModule.forFeature([ModelRegistryEntity]), AnalysisModule, CommonModule],
  controllers: [ForecastingController],
  providers: [ModelRegistryRepository, ForecastingService],
  exports: [ForecastingService],
})
export class ForecastingModule {}
