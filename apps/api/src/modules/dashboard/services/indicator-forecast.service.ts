import { Inject, Injectable } from '@nestjs/common'
import type { IndicatorForecastResponse } from '@vigia/contracts'
import {
  INSUFFICIENT_EVIDENCE,
  buildOutlook,
  forecastIndicator,
  indicatorId,
  indicatorLabel,
  parseIndicator,
} from '@vigia/epidemiology'

import { forecastGranularity, indicatorSeries, nextPeriod } from '../lib/dashboard-data'
import { DashboardRepository } from '../repositories/dashboard.repository'

const HISTORY_SEASONS = 2
const SEASON = { week: 52, month: 12 } as const

@Injectable()
export class IndicatorForecastService {
  constructor(@Inject(DashboardRepository) private readonly repository: DashboardRepository) {}

  // Pronostica el indicador de una carga y, si es un conteo semanal, proyecta los próximos años
  async forecast(uploadId: number, indicatorParam?: string): Promise<IndicatorForecastResponse> {
    const { columns, rows } = await this.repository.dataset(uploadId)
    const indicator = parseIndicator(indicatorParam, columns)
    const header = {
      indicator: { id: indicatorId(indicator), label: indicatorLabel(indicator, columns) },
    }
    const granularity = forecastGranularity(columns, rows)
    if (!granularity) {
      return {
        ...header,
        granularity: null,
        status: INSUFFICIENT_EVIDENCE,
        mase: null,
        windows: 0,
        reason: 'Este archivo no tiene fechas, semanas ni meses: no se puede pronosticar.',
        history: [],
        forecast: [],
        outlook: null,
      }
    }

    const series = indicatorSeries(columns, rows, indicator, granularity)
    const contiguous = series.slice(series.map((point) => point.value).lastIndexOf(null) + 1)
    const result = forecastIndicator(
      contiguous.map((point) => point.value ?? 0),
      granularity,
    )
    let period = contiguous[result.used - 1]?.period ?? series.at(-1)?.period ?? ''
    const forecast = result.points.map(({ p10, p50, p90 }) => {
      period = nextPeriod(period, granularity)
      return { period, p10, p50, p90 }
    })
    const outlook =
      granularity === 'week' && indicator.kind !== 'mean' && contiguous.length > 0
        ? buildOutlook(
            contiguous.map((point) => {
              const [year, week] = point.period.split('-S').map(Number) as [number, number]
              return { department: 'Total', year, epi_week: week, cases: point.value ?? 0 }
            }),
          )
        : null

    return {
      ...header,
      granularity,
      status: result.status,
      mase: result.mase,
      windows: result.windows,
      reason: result.reason,
      history: series.slice(-HISTORY_SEASONS * SEASON[granularity]),
      forecast,
      outlook,
    }
  }
}
