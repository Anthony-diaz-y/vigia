import { Inject, Injectable } from '@nestjs/common'
import type {
  AnomalyRow,
  GeoLevel,
  HeatmapResponse,
  InterannualRow,
  RankingRow,
  WeeklySeriesRow,
} from '@vigia/contracts'

import { buildAnomalies, buildHeatmap, buildInterannual, buildRanking } from '../domain/analysis'
import { AnalysisRepository } from '../infrastructure/analysis.repository'

@Injectable()
export class AnalysisService {
  constructor(@Inject(AnalysisRepository) private readonly repository: AnalysisRepository) {}

  async series(level: GeoLevel, uploadId?: number): Promise<WeeklySeriesRow[]> {
    await this.repository.assertScope(uploadId)
    return this.repository.weeklyCases(level, uploadId)
  }

  async interannual(
    level: GeoLevel,
    geography?: string,
    uploadId?: number,
  ): Promise<InterannualRow[]> {
    await this.repository.assertScope(uploadId)
    const rows = await this.repository.weeklyCases(level, uploadId)
    return buildInterannual(rows, level, geography)
  }

  async heatmap(level: GeoLevel, year: number, uploadId?: number): Promise<HeatmapResponse> {
    await this.repository.assertScope(uploadId)
    const rows = await this.repository.weeklyCases(level, uploadId)
    return buildHeatmap(rows, year, level)
  }

  async ranking(level: GeoLevel, year?: number, uploadId?: number): Promise<RankingRow[]> {
    await this.repository.assertScope(uploadId)
    const rows = await this.repository.weeklyCases(level, uploadId)
    return buildRanking(rows, level, year)
  }

  async anomalies(level: GeoLevel, uploadId?: number): Promise<AnomalyRow[]> {
    await this.repository.assertScope(uploadId)
    const rows = await this.repository.weeklyCases(level, uploadId)
    return buildAnomalies(rows, level)
  }
}
