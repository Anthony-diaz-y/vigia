/**
 * Seasonal-naive-plus-drift forecasting with a rolling-origin backtest.
 *
 * This is a dependency-free port of `src/vigia/forecast/model.py` and
 * `metrics.py`. The point forecast (p50) is the seasonal naive value plus the
 * mean year-over-year drift; p10/p90 come from the empirical quantiles of the
 * backtest residuals. The publication gate is MASE < 1 against the seasonal
 * naive baseline.
 */

import { advanceEpiWeek, WEEKS_PER_YEAR, type ForecastStatus } from './contract'

export const PUBLISH = 'publish' as const
export const INSUFFICIENT_EVIDENCE = 'insufficient_evidence' as const

export interface ForecastConfig {
  horizon: number
  minWindows: number
  provisionalWeeks: number
  season: number
  intervalAlpha: number
}

export const DEFAULT_FORECAST_CONFIG: ForecastConfig = {
  horizon: 4,
  minWindows: 3,
  provisionalWeeks: 6,
  season: WEEKS_PER_YEAR,
  intervalAlpha: 0.2,
}

/** The canonical (snake_case) config used by the Python model registry. */
export interface ForecastConfigDict {
  horizon: number
  min_windows: number
  provisional_weeks: number
  season: number
  interval_alpha: number
}

export interface WeeklyPoint {
  department: string
  province?: string
  year: number
  epi_week: number
  cases: number
}

export type GeoLevel = 'department' | 'province'

export interface GeoGroup {
  geo: string[]
  rows: WeeklyPoint[]
}

export interface ForecastScore {
  windows: number
  mase: number | null
  wis: number | null
  status: ForecastStatus
}

export interface ForecastScoreRow extends ForecastScore {
  department: string
  province?: string
}

export interface ForecastQuantileRow {
  department: string
  province?: string
  horizon: number
  target_year: number
  target_epi_week: number
  p10: number
  p50: number
  p90: number
}

export interface ForecastSeriesResult {
  scorecard: ForecastScoreRow[]
  forecasts: ForecastQuantileRow[]
  minYear: number
  maxYear: number
}

export interface BacktestResult {
  errors: number[][]
  forecasts: number[][]
  actuals: number[][]
  baselineErrors: number[][]
  origins: number[]
  nWindows: number
}

export function configToDict(config: ForecastConfig): ForecastConfigDict {
  return {
    horizon: config.horizon,
    min_windows: config.minWindows,
    provisional_weeks: config.provisionalWeeks,
    season: config.season,
    interval_alpha: config.intervalAlpha,
  }
}

export function yearOverYearDrift(
  values: readonly number[],
  season: number = WEEKS_PER_YEAR,
): number {
  const n = values.length
  if (n < season) {
    throw new Error('year-over-year drift needs at least one full season')
  }
  if (n >= 2 * season) {
    let total = 0
    for (let index = 0; index < season; index += 1) {
      total += valueAt(values, n - season + index) - valueAt(values, n - 2 * season + index)
    }
    return total / season
  }
  if (n > season) {
    let total = 0
    for (let index = 0; index < n - season; index += 1) {
      total += valueAt(values, season + index) - valueAt(values, index)
    }
    return total / (n - season)
  }
  return 0
}

/**
 * Point forecast: seasonal naive plus the mean year-over-year drift.
 * `values` is a chronological weekly series with at least one full season.
 */
export function seasonalDriftForecast(
  values: readonly number[],
  horizon: number,
  season: number = WEEKS_PER_YEAR,
): number[] {
  const n = values.length
  if (n < season) {
    throw new Error('seasonal drift needs at least one full season of history')
  }
  const drift = yearOverYearDrift(values, season)
  const forecast: number[] = []
  for (let step = 1; step <= horizon; step += 1) {
    forecast.push(valueAt(values, n - season + step - 1) + drift)
  }
  return forecast
}

/** Rolling-origin backtest with a seasonal naive baseline. */
export function rollingBacktest(values: readonly number[], config: ForecastConfig): BacktestResult {
  const n = values.length
  const horizon = config.horizon
  const season = config.season
  const origins: number[] = []
  for (let origin = n - horizon; origin >= season; origin -= 1) {
    origins.push(origin)
  }

  const size = origins.length
  const errors = emptyMatrix(size, horizon)
  const forecasts = emptyMatrix(size, horizon)
  const actuals = emptyMatrix(size, horizon)
  const baselineErrors = emptyMatrix(size, horizon)

  origins.forEach((origin, row) => {
    const point = seasonalDriftForecast(values.slice(0, origin), horizon, season)
    for (let step = 0; step < horizon; step += 1) {
      const actual = valueAt(values, origin + step)
      const baseline = valueAt(values, origin + step - season)
      setCell(forecasts, row, step, valueAt(point, step))
      setCell(actuals, row, step, actual)
      setCell(errors, row, step, actual - valueAt(point, step))
      setCell(baselineErrors, row, step, actual - baseline)
    }
  })

  return {
    errors,
    forecasts,
    actuals,
    baselineErrors,
    origins,
    nWindows: origins.length,
  }
}

/**
 * Mean absolute scaled error against a baseline. Values below 1 mean the model
 * beats the baseline; a perfect baseline returns NaN.
 */
export function mase(modelErrors: readonly number[], baselineErrors: readonly number[]): number {
  if (modelErrors.length === 0 || baselineErrors.length === 0) {
    return Number.NaN
  }
  const baselineMae = meanAbsolute(baselineErrors)
  if (baselineMae === 0) {
    return Number.NaN
  }
  return meanAbsolute(modelErrors) / baselineMae
}

export function intervalScore(actual: number, lower: number, upper: number, alpha: number): number {
  let width = upper - lower
  if (actual < lower) {
    width += (2 / alpha) * (lower - actual)
  } else if (actual > upper) {
    width += (2 / alpha) * (actual - upper)
  }
  return width
}

/** WIS for a median plus one central `(1 - alpha)` interval. */
export function weightedIntervalScore(
  actual: number,
  median: number,
  lower: number,
  upper: number,
  alpha: number,
): number {
  const numerator =
    0.5 * Math.abs(actual - median) + (alpha / 2) * intervalScore(actual, lower, upper, alpha)
  return numerator / 1.5
}

/** NumPy-compatible linear-interpolation percentile (`np.percentile` default). */
export function percentile(values: readonly number[], percent: number): number {
  if (values.length === 0) {
    return Number.NaN
  }
  const sorted = [...values].sort((left, right) => left - right)
  const position = ((sorted.length - 1) * percent) / 100
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const low = valueAt(sorted, lower)
  const high = valueAt(sorted, upper)
  return low + (high - low) * (position - lower)
}

export function column(matrix: readonly number[][], index: number): number[] {
  return matrix.map((row) => valueAt(row, index))
}

/** MASE, WIS and publication status for one geography's backtest. */
export function scorecardRow(bt: BacktestResult, config: ForecastConfig): ForecastScore {
  if (bt.nWindows < config.minWindows) {
    return {
      windows: bt.nWindows,
      mase: null,
      wis: null,
      status: INSUFFICIENT_EVIDENCE,
    }
  }
  const value = mase(bt.errors.flat(), bt.baselineErrors.flat())
  const status = value < 1 ? PUBLISH : INSUFFICIENT_EVIDENCE
  const wis = weightedIntervalScoreOver(bt, config)
  return {
    windows: bt.nWindows,
    mase: finiteOrNull(round10(value)),
    wis: finiteOrNull(round10(wis)),
    status,
  }
}

/** Group rows by geography and order them like pandas `groupby(sort=True)`. */
export function groupByGeography(rows: readonly WeeklyPoint[], level: GeoLevel): GeoGroup[] {
  const groups = new Map<string, GeoGroup>()
  for (const row of rows) {
    const geo = level === 'department' ? [row.department] : [row.department, row.province ?? '']
    const key = JSON.stringify(geo)
    const existing = groups.get(key)
    if (existing) {
      existing.rows.push(row)
    } else {
      groups.set(key, { geo, rows: [row] })
    }
  }

  const ordered = [...groups.values()].sort((left, right) => compareGeo(left.geo, right.geo))
  for (const group of ordered) {
    group.rows.sort((left, right) => left.year - right.year || left.epi_week - right.epi_week)
  }
  return ordered
}

/**
 * Run the forecast for a weekly series. Mirrors `forecast()` in Python minus
 * file I/O and the registry artifact.
 */
export function forecastSeries(
  rows: readonly WeeklyPoint[],
  level: GeoLevel,
  config: ForecastConfig = DEFAULT_FORECAST_CONFIG,
): ForecastSeriesResult {
  const scorecard: ForecastScoreRow[] = []
  const forecasts: ForecastQuantileRow[] = []

  for (const group of groupByGeography(rows, level)) {
    const geo = geoFields(group.geo)
    let values = group.rows.map((row) => row.cases)
    let weeks = group.rows.map((row) => [row.year, row.epi_week] as [number, number])

    if (config.provisionalWeeks > 0 && values.length > config.provisionalWeeks) {
      values = values.slice(0, -config.provisionalWeeks)
      weeks = weeks.slice(0, -config.provisionalWeeks)
    }

    if (values.length < config.season) {
      scorecard.push({
        ...geo,
        windows: 0,
        mase: null,
        wis: null,
        status: INSUFFICIENT_EVIDENCE,
      })
      continue
    }

    const bt = rollingBacktest(values, config)
    const scored = scorecardRow(bt, config)
    scorecard.push({ ...geo, ...scored })

    if (scored.status === PUBLISH) {
      forecasts.push(...productionRows(geo, values, bt, valueAt(weeks, weeks.length - 1), config))
    }
  }

  return {
    scorecard,
    forecasts,
    minYear: rows.length === 0 ? 0 : Math.min(...rows.map((row) => row.year)),
    maxYear: rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.year)),
  }
}

function productionRows(
  geo: { department: string; province?: string },
  values: readonly number[],
  bt: BacktestResult,
  lastWeek: [number, number],
  config: ForecastConfig,
): ForecastQuantileRow[] {
  const point = seasonalDriftForecast(values, config.horizon, config.season)
  const lowQuantiles = Array.from({ length: config.horizon }, (_, step) =>
    percentile(column(bt.errors, step), 10),
  )
  const highQuantiles = Array.from({ length: config.horizon }, (_, step) =>
    percentile(column(bt.errors, step), 90),
  )

  const rows: ForecastQuantileRow[] = []
  for (let step = 0; step < config.horizon; step += 1) {
    const [targetYear, targetWeek] = advanceEpiWeek(lastWeek[0], lastWeek[1], step + 1)
    const median = valueAt(point, step)
    rows.push({
      ...geo,
      horizon: step + 1,
      target_year: targetYear,
      target_epi_week: targetWeek,
      p10: round10(median + valueAt(lowQuantiles, step)),
      p50: round10(median),
      p90: round10(median + valueAt(highQuantiles, step)),
    })
  }
  return rows
}

function weightedIntervalScoreOver(bt: BacktestResult, config: ForecastConfig): number {
  const lowQuantiles = Array.from({ length: config.horizon }, (_, step) =>
    percentile(column(bt.errors, step), 10),
  )
  const highQuantiles = Array.from({ length: config.horizon }, (_, step) =>
    percentile(column(bt.errors, step), 90),
  )

  const scores: number[] = []
  for (let row = 0; row < bt.nWindows; row += 1) {
    for (let step = 0; step < config.horizon; step += 1) {
      const median = valueAt(valueAt(bt.forecasts, row), step)
      scores.push(
        weightedIntervalScore(
          valueAt(valueAt(bt.actuals, row), step),
          median,
          median + valueAt(lowQuantiles, step),
          median + valueAt(highQuantiles, step),
          config.intervalAlpha,
        ),
      )
    }
  }
  return scores.length === 0 ? Number.NaN : average(scores)
}

function emptyMatrix(rows: number, columns: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => 0))
}

function setCell(matrix: number[][], row: number, column: number, value: number): void {
  const target = matrix[row]
  if (target) {
    target[column] = value
  }
}

function meanAbsolute(values: readonly number[]): number {
  return average(values.map((value) => Math.abs(value)))
}

function average(values: readonly number[]): number {
  let total = 0
  for (const value of values) {
    total += value
  }
  return total / values.length
}

function geoFields(geo: readonly string[]): { department: string; province?: string } {
  if (geo.length === 1) {
    return { department: geo[0] ?? '' }
  }
  return { department: geo[0] ?? '', province: geo[1] ?? '' }
}

function compareGeo(left: readonly string[], right: readonly string[]): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const compared = compareText(left[index] ?? '', right[index] ?? '')
    if (compared !== 0) {
      return compared
    }
  }
  return 0
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

function valueAt<T>(values: readonly T[], index: number): T {
  const value = values[index]
  if (value === undefined) {
    throw new Error(`index ${index} out of range`)
  }
  return value
}

function round10(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(10)) : value
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null
}
