import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import type { GeoLevel, WeeklySeriesRow } from '@vigia/contracts'
import {
  defaultIndicator,
  indicatorId,
  indicatorLabel,
  isDengueTopic,
  parseIndicator,
  type Indicator,
} from '@vigia/epidemiology'
import { DataSource } from 'typeorm'

import { weeklyIndicatorRows } from '../../dashboard/lib/dashboard-data'
import { DashboardRepository } from '../../dashboard/repositories/dashboard.repository'

interface WeeklyQueryRow {
  department: string
  province?: string
  year: number
  epi_week: number
  cases: string | number
}

interface ExistsRow {
  present: boolean
}

export interface SeriesContext {
  topic: string
  indicator: Indicator
  label: string
  generic: boolean
}

const LEGACY_CONTEXT: SeriesContext = {
  topic: 'dengue',
  indicator: { kind: 'records' },
  label: 'Casos',
  generic: false,
}

@Injectable()
export class AnalysisRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(DashboardRepository) private readonly datasets: DashboardRepository,
  ) {}

  // Lanza 404 si la carga pedida no existe o si no hay ninguna carga
  async assertScope(uploadId?: number): Promise<void> {
    if (uploadId !== undefined) {
      const rows = await this.dataSource.query<ExistsRow[]>(
        'SELECT EXISTS(SELECT 1 FROM "uploads" WHERE id = $1) AS present',
        [uploadId],
      )
      if (!rows[0]?.present) {
        throw new NotFoundException('carga no encontrada')
      }
      return
    }

    const rows = await this.dataSource.query<ExistsRow[]>(
      'SELECT EXISTS(SELECT 1 FROM "uploads") AS present',
    )
    if (!rows[0]?.present) {
      throw new NotFoundException('sin datos: sube un archivo de vigilancia')
    }
  }

  // Tema, indicador y fuente de la serie: la capa epidemiológica o las filas genéricas del archivo
  async seriesContext(uploadId?: number, indicatorParam?: string): Promise<SeriesContext> {
    if (uploadId === undefined) {
      return { ...LEGACY_CONTEXT }
    }
    const meta = await this.datasets.meta(uploadId)
    const indicator = parseIndicator(indicatorParam, meta.columns)
    const isDefault = indicatorId(indicator) === indicatorId(defaultIndicator(meta.columns))
    const generic = !meta.epi || !isDefault
    return {
      topic: meta.topic,
      indicator,
      label:
        isDengueTopic(meta.topic) && !generic ? 'Casos' : indicatorLabel(indicator, meta.columns),
      generic,
    }
  }

  // Serie semanal por lugar: de la capa epidemiológica o calculada con el indicador del archivo
  async weeklyCases(
    level: GeoLevel,
    uploadId?: number,
    indicator?: string,
  ): Promise<WeeklySeriesRow[]> {
    const context = await this.seriesContext(uploadId, indicator)
    if (!context.generic || uploadId === undefined) {
      return this.epiWeeklyCases(level, uploadId)
    }
    const dataset = await this.datasets.dataset(uploadId)
    return weeklyIndicatorRows(dataset.columns, dataset.rows, context.indicator, level)
  }

  // Agrega en PostgreSQL los casos por geografía, año y semana
  private async epiWeeklyCases(level: GeoLevel, uploadId?: number): Promise<WeeklySeriesRow[]> {
    const geo = level === 'department' ? ['department'] : ['department', 'province']
    const selected = geo.map((column) => `"${column}"`).join(', ')
    const ordered = geo.map((column) => `"${column}" COLLATE "C"`).join(', ')
    const params: unknown[] = []
    const where = uploadId === undefined ? '' : 'WHERE "upload_id" = $1'
    if (uploadId !== undefined) {
      params.push(uploadId)
    }

    const rows = await this.dataSource.query<WeeklyQueryRow[]>(
      `
      SELECT ${selected}, "year"::int AS year, "epi_week"::int AS epi_week,
             SUM("cases")::bigint AS cases
      FROM "surveillance_cases"
      ${where}
      GROUP BY ${selected}, "year", "epi_week"
      ORDER BY ${ordered}, "year", "epi_week"
      `,
      params,
    )

    return rows.map((row) => {
      if (level === 'department') {
        return {
          department: row.department,
          year: Number(row.year),
          epi_week: Number(row.epi_week),
          cases: Number(row.cases),
        }
      }
      return {
        department: row.department,
        province: row.province ?? '',
        year: Number(row.year),
        epi_week: Number(row.epi_week),
        cases: Number(row.cases),
      }
    })
  }
}
