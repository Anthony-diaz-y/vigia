import { Inject, Injectable } from '@nestjs/common'
import type {
  AnomalyRow,
  GeoLevel,
  HeatmapResponse,
  InterannualRow,
  RankingRow,
  WeeklySeriesRow,
} from '@vigia/contracts'

import {
  buildAnomalies,
  buildHeatmap,
  buildInterannual,
  buildRanking,
  type Aggregate,
} from '../lib/analysis'
import { AnalysisRepository } from '../repositories/analysis.repository'

@Injectable()
export class AnalysisService {
  constructor(@Inject(AnalysisRepository) private readonly repository: AnalysisRepository) {}

  // Valida el alcance y devuelve la serie semanal agregada
  async series(level: GeoLevel, uploadId?: number, indicator?: string): Promise<WeeklySeriesRow[]> {
    await this.repository.assertScope(uploadId)
    return this.repository.weeklyCases(level, uploadId, indicator)
  }

  // Valida el alcance y arma la comparación interanual
  async interannual(
    level: GeoLevel,
    geography?: string,
    uploadId?: number,
    indicator?: string,
  ): Promise<InterannualRow[]> {
    await this.repository.assertScope(uploadId)
    const rows = await this.repository.weeklyCases(level, uploadId, indicator)
    return buildInterannual(rows, level, geography, await this.aggregate(uploadId, indicator))
  }

  // Valida el alcance y arma el mapa de calor del año
  async heatmap(
    level: GeoLevel,
    year: number,
    uploadId?: number,
    indicator?: string,
  ): Promise<HeatmapResponse> {
    await this.repository.assertScope(uploadId)
    const rows = await this.repository.weeklyCases(level, uploadId, indicator)
    return buildHeatmap(rows, year, level)
  }

  // Valida el alcance y arma el ranking de geografías
  async ranking(
    level: GeoLevel,
    year?: number,
    uploadId?: number,
    indicator?: string,
  ): Promise<RankingRow[]> {
    await this.repository.assertScope(uploadId)
    const rows = await this.repository.weeklyCases(level, uploadId, indicator)
    return buildRanking(rows, level, year, await this.aggregate(uploadId, indicator))
  }

  // Valida el alcance y detecta anomalías en la serie
  async anomalies(level: GeoLevel, uploadId?: number, indicator?: string): Promise<AnomalyRow[]> {
    await this.repository.assertScope(uploadId)
    const rows = await this.repository.weeklyCases(level, uploadId, indicator)
    return buildAnomalies(rows, level)
  }

  // Indica si el indicador es un promedio, para no sumar promedios semanales
  private async aggregate(uploadId?: number, indicator?: string): Promise<Aggregate> {
    const context = await this.repository.seriesContext(uploadId, indicator)
    return context.indicator.kind === 'mean' ? 'mean' : 'sum'
  }
}
