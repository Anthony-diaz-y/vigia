import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common'
import type {
  AnomalyRow,
  HeatmapResponse,
  InterannualRow,
  RankingRow,
  WeeklySeriesRow,
} from '@vigia/contracts'

import { AccessTokenGuard } from '../../identity/interface/access-token.guard'
import { parseInteger, parseLevel, parseOptionalInteger } from '../../../shared/http/query'
import { AnalysisService } from '../application/analysis.service'

@Controller('analysis')
@UseGuards(AccessTokenGuard)
export class AnalysisController {
  constructor(@Inject(AnalysisService) private readonly analysis: AnalysisService) {}

  // Devuelve la serie semanal de casos por geografía
  @Get('series')
  series(
    @Query('level') level = 'department',
    @Query('upload_id') uploadId?: string,
  ): Promise<WeeklySeriesRow[]> {
    return this.analysis.series(parseLevel(level), parseUploadId(uploadId))
  }

  // Devuelve la comparación interanual de casos por semana
  @Get('interannual')
  interannual(
    @Query('level') level = 'department',
    @Query('geography') geography?: string,
    @Query('upload_id') uploadId?: string,
  ): Promise<InterannualRow[]> {
    return this.analysis.interannual(parseLevel(level), geography, parseUploadId(uploadId))
  }

  // Devuelve el mapa de calor de casos por geografía y semana de un año
  @Get('heatmap')
  heatmap(
    @Query('year') year: string | undefined,
    @Query('level') level = 'department',
    @Query('upload_id') uploadId?: string,
  ): Promise<HeatmapResponse> {
    return this.analysis.heatmap(
      parseLevel(level),
      parseInteger(year, 'year'),
      parseUploadId(uploadId),
    )
  }

  // Devuelve el ranking de geografías por total de casos
  @Get('ranking')
  ranking(
    @Query('level') level = 'department',
    @Query('year') year?: string,
    @Query('upload_id') uploadId?: string,
  ): Promise<RankingRow[]> {
    return this.analysis.ranking(
      parseLevel(level),
      parseOptionalInteger(year, 'year'),
      parseUploadId(uploadId),
    )
  }

  // Devuelve las semanas con su z-score robusto y marca de anomalía
  @Get('anomalies')
  anomalies(
    @Query('level') level = 'department',
    @Query('upload_id') uploadId?: string,
  ): Promise<AnomalyRow[]> {
    return this.analysis.anomalies(parseLevel(level), parseUploadId(uploadId))
  }
}

// Parsea el parámetro opcional upload_id como entero
function parseUploadId(value: string | undefined): number | undefined {
  return parseOptionalInteger(value, 'upload_id')
}
