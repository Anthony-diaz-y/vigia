import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import type { RecommendationsResponse } from '@vigia/contracts'

import { parseOptionalInteger } from '../../../shared/http/query'
import { AccessTokenGuard } from '../../identity/interface/access-token.guard'
import { RecommendationsService } from '../application/recommendations.service'

@Controller('recommendations')
@UseGuards(AccessTokenGuard)
export class RecommendationsController {
  constructor(
    @Inject(RecommendationsService) private readonly recommendations: RecommendationsService,
  ) {}

  // Devuelve las recomendaciones por departamento para una carga opcional
  @Get()
  list(
    @Query('upload_id') uploadId?: string,
    @Query('indicator') indicator?: string,
  ): Promise<RecommendationsResponse> {
    return this.recommendations.recommendations(
      parseOptionalInteger(uploadId, 'upload_id'),
      indicator,
    )
  }
}
