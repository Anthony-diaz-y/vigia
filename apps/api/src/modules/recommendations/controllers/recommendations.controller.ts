import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import type { RecommendationsResponse } from '@vigia/contracts'

import { AccessTokenGuard } from '../../../common/guards/access-token.guard'
import { parseOptionalInteger } from '../../../common/utils/query'
import { RecommendationsService } from '../services/recommendations.service'

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
