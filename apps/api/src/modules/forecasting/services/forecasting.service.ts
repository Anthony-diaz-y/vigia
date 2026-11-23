import { Inject, Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import type { ForecastResponse, GeoLevel, WeeklySeriesRow } from '@vigia/contracts'
import {
  configToDict,
  DEFAULT_FORECAST_CONFIG,
  forecastSeries,
  indicatorId,
} from '@vigia/epidemiology'
import { DataSource } from 'typeorm'

import { AnalysisRepository } from '../../analysis/repositories/analysis.repository'
import { modelId } from '../lib/model-id'
import { ModelRegistryRepository } from '../repositories/model-registry.repository'

interface FileHashRow {
  file_hash: string
}

@Injectable()
export class ForecastingService {
  constructor(
    @Inject(AnalysisRepository) private readonly analysis: AnalysisRepository,
    @Inject(ModelRegistryRepository)
    private readonly registry: ModelRegistryRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Genera el pronóstico estacional (reusa la serie si ya se calculó), lo registra y lo devuelve
  async forecast(
    level: GeoLevel,
    uploadId?: number,
    indicator?: string,
    series?: WeeklySeriesRow[],
  ): Promise<ForecastResponse> {
    await this.analysis.assertScope(uploadId)
    const context = await this.analysis.seriesContext(uploadId, indicator)
    const rows = series ?? (await this.analysis.weeklyCases(level, uploadId, indicator))
    const config = DEFAULT_FORECAST_CONFIG
    const result = forecastSeries(rows, level, config)

    const dataCut = {
      level,
      file_hashes: await this.fileHashes(uploadId),
      min_year: result.minYear,
      max_year: result.maxYear,
      n_geographies: result.scorecard.length,
      ...(context.generic ? { indicator: indicatorId(context.indicator) } : {}),
    }
    const configDict = configToDict(config)
    const identifier = modelId(configDict, dataCut)

    await this.registry.save({
      modelId: identifier,
      level,
      config: configDict,
      dataCut,
      scorecard: result.scorecard,
      forecasts: result.forecasts,
    })

    return {
      model_id: identifier,
      scorecard: result.scorecard,
      forecasts: result.forecasts,
    }
  }

  // Obtiene los hashes ordenados de los archivos cargados (o de una sola carga)
  private async fileHashes(uploadId?: number): Promise<string[]> {
    const rows =
      uploadId === undefined
        ? await this.dataSource.query<FileHashRow[]>('SELECT "file_hash" FROM "uploads"')
        : await this.dataSource.query<FileHashRow[]>(
            'SELECT "file_hash" FROM "uploads" WHERE "id" = $1',
            [uploadId],
          )
    return rows.map((row) => row.file_hash).sort()
  }
}
