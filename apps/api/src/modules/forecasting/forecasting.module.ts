import { Module } from '@nestjs/common'

import { ModelRegistryEntity } from './infrastructure/persistence/model-registry.entity'
import { TypeOrmModule } from '@nestjs/typeorm'

@Module({
  imports: [TypeOrmModule.forFeature([ModelRegistryEntity])],
  exports: [TypeOrmModule],
})
export class ForecastingModule {}
