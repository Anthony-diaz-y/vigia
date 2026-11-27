import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common'
import type { DashboardResponse, IndicatorForecastResponse } from '@vigia/contracts'

import { AuthGuard } from '../../../common/auth/auth.guard'
import { parseInteger, parseOptionalInteger } from '../../../common/utils/query'
import { DashboardService } from '../services/dashboard.service'
import { IndicatorForecastService } from '../services/indicator-forecast.service'

@Controller()
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(
    @Inject(DashboardService) private readonly dashboards: DashboardService,
    @Inject(IndicatorForecastService) private readonly forecasts: IndicatorForecastService,
  ) {}

  // Devuelve el tablero adaptado a las columnas de la carga elegida
  @Get('dashboard')
  dashboard(
    @Query('upload_id') uploadId?: string,
    @Query('indicator') indicator?: string,
    @Query('year') year?: string,
  ): Promise<DashboardResponse> {
    return this.dashboards.dashboard(
      parseInteger(uploadId, 'upload_id'),
      indicator,
      parseOptionalInteger(year, 'year'),
    )
  }

  // Devuelve el pronóstico del indicador elegido para cualquier archivo con tiempo
  @Get('forecast/indicator')
  forecast(
    @Query('upload_id') uploadId?: string,
    @Query('indicator') indicator?: string,
  ): Promise<IndicatorForecastResponse> {
    return this.forecasts.forecast(parseInteger(uploadId, 'upload_id'), indicator)
  }

  // Devuelve los años con datos de una carga para el filtro de año
  @Get('uploads/:id/years')
  years(@Param('id') id: string): Promise<number[]> {
    return this.dashboards.years(parseInteger(id, 'id'))
  }
}
