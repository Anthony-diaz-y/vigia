/**
 * SHAP top-k drivers per geographic unit via exact linear SHAP.
 *
 * Port of `src/vigia/explain/drivers.py` and `narrative.py`. The explanation
 * model is a ridge regression over six engineered features, fit per geography.
 * Linear SHAP is closed form (`phi_j = w_j * (x_j - mean_j)`), so no external
 * library is needed.
 */

import { WEEKS_PER_YEAR } from './contract'
import { groupByGeography, yearOverYearDrift, type GeoLevel, type WeeklyPoint } from './forecast'

export const FEATURES = [
  'recent_level',
  'recent_level_2w',
  'seasonal_baseline',
  'year_over_year_trend',
  'seasonal_phase_sin',
  'seasonal_phase_cos',
] as const

export type Feature = (typeof FEATURES)[number]

export const DRIVER_LABELS: Readonly<Record<Feature, string>> = {
  recent_level: 'Casos recientes',
  recent_level_2w: 'Casos hace 2 semanas',
  seasonal_baseline: 'Temporada previa',
  year_over_year_trend: 'Tendencia interanual',
  seasonal_phase_sin: 'Estacionalidad',
  seasonal_phase_cos: 'Estacionalidad (fase)',
}

/** Deterministic driver -> preventive action table. The LLM never writes these. */
export const ACTION_TABLE: Readonly<Record<Feature, string>> = {
  recent_level: 'Intensificar la investigación de casos en las unidades notificadoras.',
  recent_level_2w: 'Sostener la vigilancia activa en los distritos con transmisión reciente.',
  seasonal_baseline: 'Preparar capacidad de respuesta antes del pico estacional esperado.',
  year_over_year_trend: 'Reforzar el control larvario para contrarrestar la tendencia creciente.',
  seasonal_phase_sin: 'Calendarizar las campañas preventivas según la temporada de transmisión.',
  seasonal_phase_cos: 'Alinear personal e insumos con la temporada de transmisión.',
}

export const DEFAULT_RIDGE_LAMBDA = 1
export const DEFAULT_PROVISIONAL_WEEKS = 6
export const DEFAULT_TOP_K = 5

export interface DriverRow {
  department: string
  province?: string
  rank: number
  feature: Feature
  driver: string
  mean_shap: number
  abs_mean_shap: number
  direction: 'up' | 'down'
}

export interface RecommendedDriverRow extends DriverRow {
  action: string
}

export interface ExplainOptions {
  topK?: number
  ridgeLambda?: number
  provisionalWeeks?: number
}

export interface Narrative {
  source: 'template' | 'deepseek'
  text: string
}

export interface ExplainSeriesResult {
  drivers: RecommendedDriverRow[]
  narratives: Narrative[]
}

export interface NarrativePayloadDriver {
  driver: string
  feature: string
  direction: string
  mean_shap: number
  action: string
}

export interface NarrativePayload {
  unit: string
  drivers: NarrativePayloadDriver[]
}

const DIRECTIONS: Readonly<Record<string, string>> = {
  up: 'al alza',
  down: 'a la baja',
}

export function standardize(matrix: readonly number[][]): {
  standardized: number[][]
  mean: number[]
  std: number[]
} {
  const features = matrix[0]?.length ?? 0
  const mean = Array.from({ length: features }, (_, index) =>
    average(matrix.map((row) => valueAt(row, index))),
  )
  const std = Array.from({ length: features }, (_, index) =>
    Math.sqrt(average(matrix.map((row) => (valueAt(row, index) - valueAt(mean, index)) ** 2))),
  )
  const safeStd = std.map((value) => (value === 0 ? 1 : value))
  const standardized = matrix.map((row) =>
    row.map((value, index) => (value - valueAt(mean, index)) / valueAt(safeStd, index)),
  )
  return { standardized, mean, std: safeStd }
}

/** Ridge regression weights `(X^T X + lambda I)^-1 X^T y`. */
export function ridgeWeights(
  standardized: readonly number[][],
  targets: readonly number[],
  lambda: number,
): number[] {
  const features = standardized[0]?.length ?? 0
  const gram = Array.from({ length: features }, () => Array.from({ length: features }, () => 0))
  const rhs = Array.from({ length: features }, () => 0)

  standardized.forEach((row, rowIndex) => {
    for (let left = 0; left < features; left += 1) {
      rhs[left] = valueAt(rhs, left) + valueAt(row, left) * valueAt(targets, rowIndex)
      for (let right = 0; right < features; right += 1) {
        const target = gram[left]
        if (target) {
          target[right] = (target[right] ?? 0) + valueAt(row, left) * valueAt(row, right)
        }
      }
    }
  })

  for (let index = 0; index < features; index += 1) {
    const row = gram[index]
    if (row) {
      row[index] = (row[index] ?? 0) + lambda
    }
  }
  return solveLinearSystem(gram, rhs)
}

/** Per-row linear SHAP values for standardized (zero-mean) features. */
export function linearShap(
  standardized: readonly number[][],
  weights: readonly number[],
): number[][] {
  return standardized.map((row) => row.map((value, index) => value * valueAt(weights, index)))
}

/** Rank the top-k drivers per geographic unit by mean absolute SHAP. */
export function topDrivers(
  rows: readonly WeeklyPoint[],
  level: GeoLevel,
  options: ExplainOptions = {},
): DriverRow[] {
  const topK = options.topK ?? DEFAULT_TOP_K
  const lambda = options.ridgeLambda ?? DEFAULT_RIDGE_LAMBDA
  const provisionalWeeks = options.provisionalWeeks ?? DEFAULT_PROVISIONAL_WEEKS

  const drivers: DriverRow[] = []
  for (const group of groupByGeography(rows, level)) {
    const geo = geoFields(group.geo)
    let cases = group.rows.map((row) => row.cases)
    let weeks = group.rows.map((row) => [row.year, row.epi_week] as [number, number])

    if (provisionalWeeks > 0 && cases.length > provisionalWeeks) {
      cases = cases.slice(0, -provisionalWeeks)
      weeks = weeks.slice(0, -provisionalWeeks)
    }
    if (cases.length <= WEEKS_PER_YEAR) {
      continue
    }

    const { features, targets } = featureMatrix(cases, weeks)
    if (features.length < 2) {
      continue
    }

    const { standardized } = standardize(features)
    const centered = targets.map((target) => target - average(targets))
    const weights = ridgeWeights(standardized, centered, lambda)
    const shap = linearShap(standardized, weights)

    const meanShap = Array.from({ length: weights.length }, (_, index) =>
      average(shap.map((row) => valueAt(row, index))),
    )
    const absMeanShap = Array.from({ length: weights.length }, (_, index) =>
      average(shap.map((row) => Math.abs(valueAt(row, index)))),
    )

    const order = weights
      .map((_, index) => index)
      .sort((left, right) => valueAt(absMeanShap, right) - valueAt(absMeanShap, left))
      .slice(0, topK)

    order.forEach((index, position) => {
      const feature = valueAt(FEATURES, index)
      drivers.push({
        ...geo,
        rank: position + 1,
        feature,
        driver: DRIVER_LABELS[feature],
        mean_shap: precision(valueAt(meanShap, index)),
        abs_mean_shap: precision(valueAt(absMeanShap, index)),
        direction: valueAt(meanShap, index) >= 0 ? 'up' : 'down',
      })
    })
  }
  return drivers
}

/** Attach the deterministic preventive action for each driver row. */
export function recommend(drivers: readonly DriverRow[]): RecommendedDriverRow[] {
  return drivers.map((driver) => ({ ...driver, action: ACTION_TABLE[driver.feature] }))
}

/** Deterministic prose from the aggregated payload. */
export function renderTemplate(payload: NarrativePayload): string {
  const top = payload.drivers
    .map((driver) => `${driverName(driver)} (${DIRECTIONS[driver.direction] ?? driver.direction})`)
    .join(', ')
  const actions = payload.drivers
    .filter((driver) => driver.action)
    .map((driver) => driver.action)
    .join('; ')
  return (
    `Para ${payload.unit}, el pronóstico está impulsado principalmente por: ${top}. ` +
    `Acciones preventivas recomendadas: ${actions}.`
  )
}

/** Build one aggregated payload per geography from ranked drivers. */
export function narrativePayloads(drivers: readonly RecommendedDriverRow[]): NarrativePayload[] {
  const groups = new Map<string, { unit: string; rows: RecommendedDriverRow[] }>()
  for (const driver of drivers) {
    const geo =
      driver.province === undefined ? [driver.department] : [driver.department, driver.province]
    const key = JSON.stringify(geo)
    const group = groups.get(key)
    if (group) {
      group.rows.push(driver)
    } else {
      groups.set(key, { unit: geo.join(' / '), rows: [driver] })
    }
  }

  return [...groups.values()].map((group) => ({
    unit: group.unit,
    drivers: group.rows.map((driver) => ({
      driver: driver.driver,
      feature: driver.feature,
      direction: driver.direction,
      mean_shap: driver.mean_shap,
      action: driver.action,
    })),
  }))
}

/** Build one deterministic narrative per geography from ranked drivers. */
export function narrativesFromDrivers(drivers: readonly RecommendedDriverRow[]): Narrative[] {
  return narrativePayloads(drivers).map((payload) => ({
    source: 'template' as const,
    text: renderTemplate(payload),
  }))
}

export function explainSeries(
  rows: readonly WeeklyPoint[],
  level: GeoLevel,
  options: ExplainOptions = {},
): ExplainSeriesResult {
  const drivers = recommend(topDrivers(rows, level, options))
  return { drivers, narratives: narrativesFromDrivers(drivers) }
}

function featureMatrix(
  cases: readonly number[],
  weeks: readonly [number, number][],
): { features: number[][]; targets: number[] } {
  const season = WEEKS_PER_YEAR
  const features: number[][] = []
  const targets: number[] = []

  for (let index = season; index < cases.length; index += 1) {
    const [, week] = valueAt(weeks, index)
    features.push([
      valueAt(cases, index - 1),
      valueAt(cases, index - 2),
      valueAt(cases, index - season),
      yearOverYearDrift(cases.slice(0, index), season),
      Math.sin((2 * Math.PI * week) / season),
      Math.cos((2 * Math.PI * week) / season),
    ])
    targets.push(valueAt(cases, index))
  }
  return { features, targets }
}

/** Gaussian elimination with partial pivoting for a small dense system. */
function solveLinearSystem(matrix: readonly number[][], vector: readonly number[]): number[] {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, valueAt(vector, index)])

  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1) {
      const candidate = Math.abs(valueAt(valueAt(augmented, row), column))
      const current = Math.abs(valueAt(valueAt(augmented, pivot), column))
      if (candidate > current) {
        pivot = row
      }
    }

    const pivotRow = augmented[pivot]
    const columnRow = augmented[column]
    if (!pivotRow || !columnRow) {
      throw new Error('singular ridge system')
    }
    if (pivot !== column) {
      augmented[pivot] = columnRow
      augmented[column] = pivotRow
    }

    const divisor = valueAt(pivotRow, column)
    if (divisor === 0) {
      throw new Error('singular ridge system')
    }
    for (let index = column; index <= size; index += 1) {
      pivotRow[index] = valueAt(pivotRow, index) / divisor
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue
      }
      const target = augmented[row]
      if (!target) {
        continue
      }
      const factor = valueAt(target, column)
      for (let index = column; index <= size; index += 1) {
        target[index] = valueAt(target, index) - factor * valueAt(pivotRow, index)
      }
    }
  }

  return augmented.map((row) => valueAt(row, size))
}

function geoFields(geo: readonly string[]): { department: string; province?: string } {
  if (geo.length === 1) {
    return { department: geo[0] ?? '' }
  }
  return { department: geo[0] ?? '', province: geo[1] ?? '' }
}

function driverName(driver: NarrativePayloadDriver): string {
  return driver.driver || driver.feature || ''
}

function average(values: readonly number[]): number {
  let total = 0
  for (const value of values) {
    total += value
  }
  return values.length === 0 ? Number.NaN : total / values.length
}

/**
 * Match the Python JSON writer for meaningful magnitudes while leaving the
 * near-zero SHAP noise untouched (its sign is not part of the contract).
 */
function precision(value: number): number {
  return Math.abs(value) >= 1e-12 ? Number(value.toFixed(10)) : value
}

function valueAt<T>(values: readonly T[], index: number): T {
  const value = values[index]
  if (value === undefined) {
    throw new Error(`index ${index} out of range`)
  }
  return value
}
