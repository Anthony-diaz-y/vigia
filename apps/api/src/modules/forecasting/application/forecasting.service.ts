import { Inject, Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import type { ForecastResponse, GeoLevel } from '@vigia/contracts'
import { configToDict, DEFAULT_FORECAST_CONFIG, forecastSeries } from '@vigia/epidemiology'
import { DataSource } from 'typeorm'

import { AnalysisRepository } from '../../analysis/infrastructure/analysis.repository'
import { modelId } from '../domain/model-id'
import { ModelRegistryRepository } from '../infrastructure/model-registry.repository'

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

  // Genera el pronóstico estacional, lo registra por id de modelo y devuelve el formato legado
  async forecast(level: GeoLevel, uploadId?: number): Promise<ForecastResponse> {
    await this.analysis.assertScope(uploadId)
    const rows = await this.analysis.weeklyCases(level, uploadId)
    const config = DEFAULT_FORECAST_CONFIG
    const result = forecastSeries(rows, level, config)

    const dataCut = {
      level,
      file_hashes: await this.fileHashes(uploadId),
      min_year: result.minYear,
      max_year: result.maxYear,
      n_geographies: result.scorecard.length,
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
