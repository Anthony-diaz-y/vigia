import { describe, expect, it } from 'vitest'

import { advanceEpiWeek } from './contract'
import {
  DEFAULT_FORECAST_CONFIG,
  forecastSeries,
  INSUFFICIENT_EVIDENCE,
  intervalScore,
  mase,
  percentile,
  PUBLISH,
  rollingBacktest,
  scorecardRow,
  seasonalDriftForecast,
  weightedIntervalScore,
  yearOverYearDrift,
  type BacktestResult,
  type ForecastConfig,
  type WeeklyPoint,
} from './forecast'

function buildSeries(): WeeklyPoint[] {
  const seasonal = Array.from({ length: 52 }, (_, index) => 20 + ((index * 3) % 10))
  const rows: WeeklyPoint[] = []

  const add = (
    department: string,
    years: readonly number[],
    trend: number,
    noise: (index: number) => number,
  ): void => {
    for (const year of years) {
      for (let week = 1; week <= 52; week += 1) {
        const index = (year - 2022) * 52 + (week - 1)
        rows.push({
          department,
          province: department,
          year,
          epi_week: week,
          cases: seasonal[week - 1]! + trend * index + noise(index),
        })
      }
    }
  }

  add('TREND', [2022, 2023, 2024], 2, () => 0)
  add('FLAT', [2022, 2023, 2024], 0, () => 0)
  add('SHORT', [2022], 0, () => 0)
  add('NOISY', [2022, 2023, 2024], 3, (index) => ((index * 7) % 5) - 2)
  return rows
}

function backtest(errors: number, windows: number, baseline: number): BacktestResult {
  const rows = Array.from({ length: windows }, () => [errors, errors])
  const baselineRows = Array.from({ length: windows }, () => [baseline, baseline])
  return {
    errors: rows,
    forecasts: rows,
    actuals: rows,
    baselineErrors: baselineRows,
    origins: Array.from({ length: windows }, (_, index) => index),
    nWindows: windows,
  }
}

describe('forecast metrics', () => {
  it('computes MASE against the baseline', () => {
    expect(mase([1, -1, 2], [1, 2, 3])).toBeCloseTo(2 / 3, 12)
    expect(mase([1], [0, 0, 0])).toBeNaN()
    expect(mase([], [1])).toBeNaN()
  })

  it('computes interval and weighted interval scores', () => {
    expect(intervalScore(10, 6, 14, 0.2)).toBeCloseTo(8, 12)
    expect(intervalScore(3, 6, 14, 0.2)).toBeCloseTo(8 + 10 * 3, 12)
    expect(intervalScore(20, 6, 14, 0.2)).toBeCloseTo(8 + 10 * 6, 12)

    expect(weightedIntervalScore(20, 10, 6, 14, 0.2)).toBeCloseTo(11.8 / 1.5, 12)
    expect(weightedIntervalScore(10, 10, 6, 14, 0.2)).toBeCloseTo(0.8 / 1.5, 12)
  })

  it('matches numpy linear percentiles', () => {
    expect(percentile([1, 2, 3, 4], 10)).toBeCloseTo(1.3, 12)
    expect(percentile([1, 2, 3, 4], 90)).toBeCloseTo(3.7, 12)
    expect(percentile([], 10)).toBeNaN()
  })
})

describe('seasonal drift', () => {
  it('computes the mean year-over-year change', () => {
    expect(yearOverYearDrift([1, 2, 3, 4, 5, 6], 3)).toBe(3)
    expect(yearOverYearDrift([1, 2, 3], 3)).toBe(0)
    expect(yearOverYearDrift([1, 2, 3, 4], 3)).toBe(3)
  })

  it('forecasts seasonal naive plus drift', () => {
    expect(seasonalDriftForecast([1, 2, 3, 4, 5, 6], 2, 3)).toEqual([7, 8])
    expect(seasonalDriftForecast([1, 2, 3], 1, 3)).toEqual([1])
    expect(seasonalDriftForecast([1, 2, 3, 4], 1, 3)).toEqual([5])
  })

  it('advances epidemiological weeks across years', () => {
    expect(advanceEpiWeek(2024, 52, 1)).toEqual([2025, 1])
    expect(advanceEpiWeek(2024, 46, 4)).toEqual([2024, 50])
    expect(advanceEpiWeek(2024, 1, 4)).toEqual([2024, 5])
  })
})

describe('publication gate', () => {
  const config: ForecastConfig = { ...DEFAULT_FORECAST_CONFIG, horizon: 2, provisionalWeeks: 0 }

  it('rejects a model that does not beat the baseline', () => {
    const row = scorecardRow(backtest(5, 3, 1), config)
    expect(row.status).toBe(INSUFFICIENT_EVIDENCE)
    expect(row.mase).toBeCloseTo(5, 12)
  })

  it('publishes a model that beats the baseline', () => {
    const row = scorecardRow(backtest(0.5, 3, 1), config)
    expect(row.status).toBe(PUBLISH)
    expect(row.mase).toBeCloseTo(0.5, 12)
  })

  it('requires the minimum number of windows', () => {
    const row = scorecardRow(backtest(0.5, 1, 1), config)
    expect(row.status).toBe(INSUFFICIENT_EVIDENCE)
    expect(row.windows).toBe(1)
  })

  it('runs a rolling-origin backtest', () => {
    const result = rollingBacktest([1, 2, 3, 4, 5, 6], {
      ...DEFAULT_FORECAST_CONFIG,
      horizon: 1,
      season: 1,
    })
    expect(result.nWindows).toBe(5)
    expect(result.origins).toEqual([5, 4, 3, 2, 1])
  })
})

describe('forecastSeries', () => {
  it('scores every geography and publishes only winners', () => {
    const result = forecastSeries(buildSeries(), 'department')

    expect(result.scorecard.map((row) => row.department)).toEqual([
      'FLAT',
      'NOISY',
      'SHORT',
      'TREND',
    ])
    expect(result.scorecard.map((row) => Object.keys(row))).toEqual(
      Array.from({ length: 4 }, () => ['department', 'windows', 'mase', 'wis', 'status']),
    )

    const byDepartment = new Map(result.scorecard.map((row) => [row.department, row]))
    expect(byDepartment.get('TREND')?.status).toBe(PUBLISH)
    expect(byDepartment.get('TREND')?.mase).toBeCloseTo(1 / 95, 10)
    expect(byDepartment.get('FLAT')?.status).toBe(INSUFFICIENT_EVIDENCE)
    expect(byDepartment.get('FLAT')?.mase).toBeNull()
    expect(byDepartment.get('SHORT')?.status).toBe(INSUFFICIENT_EVIDENCE)
    expect(byDepartment.get('SHORT')?.windows).toBe(0)
    expect(byDepartment.get('NOISY')?.status).toBe(PUBLISH)

    expect(new Set(result.forecasts.map((row) => row.department))).toEqual(
      new Set(['NOISY', 'TREND']),
    )
  })

  it('excludes provisional weeks from training', () => {
    const result = forecastSeries(buildSeries(), 'department')
    const trend = result.forecasts.filter((row) => row.department === 'TREND')

    expect(trend.map((row) => row.target_year)).toEqual([2024, 2024, 2024, 2024])
    expect(trend.map((row) => row.target_epi_week)).toEqual([47, 48, 49, 50])
    expect(trend.map((row) => row.horizon)).toEqual([1, 2, 3, 4])
  })

  it('is reproducible', () => {
    const first = forecastSeries(buildSeries(), 'department')
    const second = forecastSeries(buildSeries(), 'department')
    expect(first).toEqual(second)
  })

  it('returns the data cut years', () => {
    const result = forecastSeries(buildSeries(), 'department')
    expect(result.minYear).toBe(2022)
    expect(result.maxYear).toBe(2024)
  })
})
