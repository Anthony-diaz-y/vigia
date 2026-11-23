import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import type { ExplainResponse } from '@vigia/contracts'

import { AccessTokenGuard } from '../../../common/guards/access-token.guard'
import { parseLevel, parseOptionalInteger } from '../../../common/utils/query'
import { ExplanationService } from '../services/explanation.service'

@Controller('explain')
@UseGuards(AccessTokenGuard)
export class ExplanationController {
  constructor(@Inject(ExplanationService) private readonly explanation: ExplanationService) {}

  // Devuelve los factores del pronóstico y su explicación en lenguaje simple
  @Get()
  explain(
    @Query('level') level = 'department',
    @Query('upload_id') uploadId?: string,
    @Query('indicator') indicator?: string,
  ): Promise<ExplainResponse> {
    return this.explanation.explain(
      parseLevel(level),
      parseOptionalInteger(uploadId, 'upload_id'),
      indicator,
    )
  }
}
