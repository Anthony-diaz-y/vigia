import { Module } from '@nestjs/common'

import { AnalysisModule } from '../analysis/analysis.module'
import { IdentityModule } from '../identity/identity.module'
import { ExplanationService } from './application/explanation.service'
import { ExplanationController } from './interface/explanation.controller'

@Module({
  imports: [AnalysisModule, IdentityModule],
  controllers: [ExplanationController],
  providers: [ExplanationService],
})
export class ExplanationModule {}
