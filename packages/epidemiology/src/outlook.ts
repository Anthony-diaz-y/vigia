import { PROVISIONAL_WEEKS } from './recommendations'

export const OUTLOOK_YEARS = 5
export const MIN_WEEKS_PER_YEAR = 50
export const MIN_WEEKS_TO_ESTIMATE = 8
const DAMPING = 0.7
const MAX_TREND_SHARE = 0.25
const MIN_SPREAD = 0.1
const MAX_SPREAD = 0.6

export const OUTLOOK_CONFIDENCE = ['baja', 'media', 'alta'] as const

export type OutlookConfidence = (typeof OUTLOOK_CONFIDENCE)[number]

export interface OutlookSeriesRow {
  department: string
  year: number
  epi_week: number
  cases: number
}

export interface AnnualPoint {
  year: number
  cases: number
  estimated: boolean
}

export interface ProjectedYear {
  year: number
  p10: number
  p50: number
  p90: number
}

export interface AnnualProjection {
  history: AnnualPoint[]
  projection: ProjectedYear[]
  annual_change_pct: number | null
}

export interface DepartmentProjection extends AnnualProjection {
  department: string
}

export interface Outlook {
  horizon_years: number
  complete_years: number
  estimated_years: number
  confidence: OutlookConfidence
  total: AnnualProjection
  departments: DepartmentProjection[]
}

type WeeklyTotals = Map<number, Map<number, number>>

// Proyecta los casos anuales a varios años para el total y cada departamento
export function buildOutlook(
  rows: readonly OutlookSeriesRow[],
  horizon: number = OUTLOOK_YEARS,
): Outlook {
  const total: WeeklyTotals = new Map()
  const departments = new Map<string, WeeklyTotals>()
  for (const row of rows) {
    addCases(total, row)
    const department = departments.get(row.department) ?? new Map()
    addCases(department, row)
    departments.set(row.department, department)
  }

  const plan = yearPlan(rows)
  const totalHistory = annualHistory(total, plan, null)
  const projected = [...departments.entries()]
    .map(([department, weekly]) => ({
      department,
      ...projectAnnual(annualHistory(weekly, plan, total), horizon),
    }))
    .sort(
      (left, right) =>
        (right.projection.at(-1)?.p50 ?? 0) - (left.projection.at(-1)?.p50 ?? 0) ||
        left.department.localeCompare(right.department),
    )

  return {
    horizon_years: horizon,
    complete_years: plan.complete.length,
    estimated_years: totalHistory.filter((point) => point.estimated).length,
    confidence: confidenceFor(plan.complete.length),
    total: projectAnnual(totalHistory, horizon),
    departments: projected,
  }
}

// Asigna la confianza según años completos: alta desde 7, media desde 4, si no baja
export function confidenceFor(completeYears: number): OutlookConfidence {
  if (completeYears >= 7) {
    return 'alta'
  }
  if (completeYears >= 4) {
    return 'media'
  }
  return 'baja'
}

interface YearPlan {
  complete: number[]
  partial: Map<number, number[]>
}

// Separa años completos (>= 50 semanas) de incompletos estimables, sin semanas provisionales
function yearPlan(rows: readonly OutlookSeriesRow[]): YearPlan {
  const weeksPerYear = new Map<number, Set<number>>()
  for (const row of rows) {
    const weeks = weeksPerYear.get(row.year) ?? new Set<number>()
    weeks.add(row.epi_week)
    weeksPerYear.set(row.year, weeks)
  }

  const timeline = [...weeksPerYear.entries()]
    .flatMap(([year, weeks]) => [...weeks].map((week) => year * 100 + week))
    .sort((left, right) => left - right)
  const provisional = new Set(timeline.slice(-PROVISIONAL_WEEKS))

  const complete: number[] = []
  const partial = new Map<number, number[]>()
  for (const [year, weeks] of [...weeksPerYear.entries()].sort(([a], [b]) => a - b)) {
    if (weeks.size >= MIN_WEEKS_PER_YEAR) {
      complete.push(year)
      continue
    }
    const usable = [...weeks].filter((week) => !provisional.has(year * 100 + week))
    if (usable.length >= MIN_WEEKS_TO_ESTIMATE) {
      partial.set(
        year,
        usable.sort((a, b) => a - b),
      )
    }
  }
  return { complete, partial }
}

// Arma el historial anual con totales reales y estimados para años incompletos
function annualHistory(
  weekly: WeeklyTotals,
  plan: YearPlan,
  fallbackShape: WeeklyTotals | null,
): AnnualPoint[] {
  if (plan.complete.length === 0) {
    return []
  }
  const points: AnnualPoint[] = plan.complete.map((year) => ({
    year,
    cases: sumWeeks(weekly.get(year)),
    estimated: false,
  }))

  for (const [year, weeks] of plan.partial) {
    const share =
      seasonalShare(weekly, plan.complete, weeks) ??
      (fallbackShape ? seasonalShare(fallbackShape, plan.complete, weeks) : null)
    if (share === null) {
      continue
    }
    const observed = sumWeeks(weekly.get(year), weeks)
    points.push({ year, cases: Math.round(observed / share), estimated: true })
  }
  return points.sort((left, right) => left.year - right.year)
}

// Calcula la fracción anual de casos de esas semanas en los años de referencia
function seasonalShare(
  weekly: WeeklyTotals,
  referenceYears: readonly number[],
  weeks: readonly number[],
): number | null {
  let part = 0
  let whole = 0
  for (const year of referenceYears) {
    part += sumWeeks(weekly.get(year), weeks)
    whole += sumWeeks(weekly.get(year))
  }
  if (whole < 50) {
    return null
  }
  const share = part / whole
  return share >= 0.1 ? share : null
}

// Proyecta con tendencia amortiguada (tope 25 % anual) y rango según la variabilidad pasada
export function projectAnnual(history: readonly AnnualPoint[], horizon: number): AnnualProjection {
  const last = history.at(-1)
  if (!last) {
    return { history: [], projection: [], annual_change_pct: null }
  }

  const n = history.length
  const meanYear = history.reduce((sum, point) => sum + point.year, 0) / n
  const meanCases = history.reduce((sum, point) => sum + point.cases, 0) / n
  const sxx = history.reduce((sum, point) => sum + (point.year - meanYear) ** 2, 0)
  const slope =
    sxx === 0
      ? 0
      : history.reduce(
          (sum, point) => sum + (point.year - meanYear) * (point.cases - meanCases),
          0,
        ) / sxx
  const cap = MAX_TREND_SHARE * last.cases
  const trend = Math.max(-cap, Math.min(cap, slope))

  const deviation =
    n > 1
      ? Math.sqrt(history.reduce((sum, point) => sum + (point.cases - meanCases) ** 2, 0) / (n - 1))
      : 0
  const variability = meanCases > 0 ? deviation / meanCases : 0
  const spread = Math.max(MIN_SPREAD, Math.min(MAX_SPREAD, variability))

  const projection: ProjectedYear[] = []
  let damping = 0
  for (let step = 1; step <= horizon; step += 1) {
    damping += DAMPING ** step
    const p50 = Math.max(0, last.cases + trend * damping)
    const half = last.cases * spread * (0.6 + 0.2 * step)
    projection.push({
      year: last.year + step,
      p10: Math.round(Math.max(0, p50 - half)),
      p50: Math.round(p50),
      p90: Math.round(p50 + half),
    })
  }

  const first = projection[0]
  return {
    history: [...history],
    projection,
    annual_change_pct:
      n < 2 || last.cases <= 0 || !first
        ? null
        : Math.round(((first.p50 - last.cases) / last.cases) * 100),
  }
}

// Suma los casos de la fila al acumulado por año y semana
function addCases(target: WeeklyTotals, row: OutlookSeriesRow): void {
  const weeks = target.get(row.year) ?? new Map<number, number>()
  weeks.set(row.epi_week, (weeks.get(row.epi_week) ?? 0) + row.cases)
  target.set(row.year, weeks)
}

// Suma los casos de todas las semanas o solo de las indicadas
function sumWeeks(weeks: Map<number, number> | undefined, only?: readonly number[]): number {
  if (!weeks) {
    return 0
  }
  if (!only) {
    return [...weeks.values()].reduce((sum, value) => sum + value, 0)
  }
  return only.reduce((sum, week) => sum + (weeks.get(week) ?? 0), 0)
}
