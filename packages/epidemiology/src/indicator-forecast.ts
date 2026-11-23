import type { ForecastStatus } from './contract'
import {
  INSUFFICIENT_EVIDENCE,
  PUBLISH,
  column,
  percentile,
  rollingBacktest,
  scorecardRow,
  seasonalDriftForecast,
  type ForecastConfig,
} from './forecast'

export type ForecastGranularity = 'week' | 'month'

export interface IndicatorForecastPoint {
  step: number
  p10: number
  p50: number
  p90: number
}

export interface IndicatorForecast {
  status: ForecastStatus
  mase: number | null
  windows: number
  reason: string | null
  points: IndicatorForecastPoint[]
  used: number
}

const CONFIGS: Readonly<Record<ForecastGranularity, ForecastConfig>> = {
  week: { horizon: 4, minWindows: 3, provisionalWeeks: 6, season: 52, intervalAlpha: 0.2 },
  month: { horizon: 3, minWindows: 3, provisionalWeeks: 1, season: 12, intervalAlpha: 0.2 },
}

const UNIT_NAMES: Readonly<Record<ForecastGranularity, string>> = {
  week: 'semanales',
  month: 'mensuales',
}

const SEASONS_REQUIRED = 2

// Redondea a 3 decimales para mostrar valores limpios
function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

// Pronostica el indicador total con naive estacional y deriva; solo publica si el MASE es menor a 1
export function forecastIndicator(
  series: readonly number[],
  granularity: ForecastGranularity,
): IndicatorForecast {
  const config = CONFIGS[granularity]
  const values =
    series.length > config.provisionalWeeks
      ? series.slice(0, -config.provisionalWeeks)
      : [...series]
  if (values.length < SEASONS_REQUIRED * config.season) {
    return {
      status: INSUFFICIENT_EVIDENCE,
      mase: null,
      windows: 0,
      reason: `Se necesitan al menos ${SEASONS_REQUIRED} años de datos ${UNIT_NAMES[granularity]}.`,
      points: [],
      used: values.length,
    }
  }

  const backtest = rollingBacktest(values, config)
  const score = scorecardRow(backtest, config)
  if (score.status !== PUBLISH) {
    return {
      status: score.status,
      mase: score.mase,
      windows: score.windows,
      reason: 'El modelo todavía no comete menos error que repetir lo ocurrido el año anterior.',
      points: [],
      used: values.length,
    }
  }

  const floor = values.every((value) => value >= 0) ? 0 : -Infinity
  const point = seasonalDriftForecast(values, config.horizon, config.season)
  const points = point.map((median, step) => {
    const errors = column(backtest.errors, step)
    return {
      step: step + 1,
      p10: round(Math.max(floor, median + percentile(errors, 10))),
      p50: round(Math.max(floor, median)),
      p90: round(Math.max(floor, median + percentile(errors, 90))),
    }
  })
  return {
    status: PUBLISH,
    mase: score.mase,
    windows: score.windows,
    reason: null,
    points,
    used: values.length,
  }
}
