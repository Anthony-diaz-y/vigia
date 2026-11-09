import { Module } from '@nestjs/common'

import { AnalysisModule } from '../analysis/analysis.module'
import { IdentityModule } from '../identity/identity.module'
import { ExportService } from './application/export.service'
import { ExportController } from './interface/export.controller'

@Module({
  imports: [AnalysisModule, IdentityModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
