import { Module } from '@nestjs/common'

import { AnalysisModule } from '../analysis/analysis.module'
import { CommonModule } from '../../common/common.module'
import { ExplanationController } from './controllers/explanation.controller'
import { ExplanationService } from './services/explanation.service'

@Module({
  imports: [AnalysisModule, CommonModule],
  controllers: [ExplanationController],
  providers: [ExplanationService],
})
export class ExplanationModule {}
