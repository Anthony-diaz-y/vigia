import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import type { ForecastResponse } from '@vigia/contracts'

import { AccessTokenGuard } from '../../../common/guards/access-token.guard'
import { parseLevel, parseOptionalInteger } from '../../../common/utils/query'
import { ForecastingService } from '../services/forecasting.service'

@Controller('forecast')
@UseGuards(AccessTokenGuard)
export class ForecastingController {
  constructor(@Inject(ForecastingService) private readonly forecasting: ForecastingService) {}

  // Devuelve el pronóstico para el nivel geográfico y la carga indicados
  @Get()
  forecast(
    @Query('level') level = 'department',
    @Query('upload_id') uploadId?: string,
    @Query('indicator') indicator?: string,
  ): Promise<ForecastResponse> {
    return this.forecasting.forecast(
      parseLevel(level),
      parseOptionalInteger(uploadId, 'upload_id'),
      indicator,
    )
  }
}
