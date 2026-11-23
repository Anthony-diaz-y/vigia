import { ACTION_TABLE, GENERAL_ACTION_TABLE, type Feature } from './explain'
import { PUBLISH } from './forecast'

export const ALERT_LEVELS = ['alto', 'medio', 'bajo'] as const

export type AlertLevel = (typeof ALERT_LEVELS)[number]

export const RECENT_WEEKS = 4
export const PROVISIONAL_WEEKS = 6
export const ANOMALY_LOOKBACK_WEEKS = 8
export const MIN_CASES_FOR_CHANGE = 10

export const LEVEL_ACTIONS: Readonly<Record<AlertLevel, readonly string[]>> = {
  alto: [
    'Activar la sala situacional esta semana.',
    'Intensificar la eliminación de criaderos en las zonas con más casos.',
  ],
  medio: [
    'Verificar que las unidades notifiquen a tiempo.',
    'Preparar insumos y personal ante un posible aumento.',
  ],
  bajo: ['Mantener la vigilancia de rutina.'],
}

export const GENERAL_LEVEL_ACTIONS: Readonly<Record<AlertLevel, readonly string[]>> = {
  alto: [
    'Revisar esta semana la situación de la zona con el equipo responsable.',
    'Verificar si el cambio es real o se debe a cambios en el registro.',
  ],
  medio: [
    'Seguir la tendencia semana a semana.',
    'Confirmar que los datos de la zona estén completos y al día.',
  ],
  bajo: ['Mantener el seguimiento de rutina.'],
}

export interface RecommendationOptions {
  indicatorLabel: string
  aggregate: 'sum' | 'mean'
  direction: 'up' | 'both'
  actions: 'dengue' | 'general'
}

export const DEFAULT_RECOMMENDATION_OPTIONS: RecommendationOptions = {
  indicatorLabel: 'Casos',
  aggregate: 'sum',
  direction: 'up',
  actions: 'dengue',
}

const MAX_ACTIONS = 2

export interface RecommendationSeriesRow {
  department: string
  year: number
  epi_week: number
  cases: number
}

export interface RecommendationAnomalyRow {
  department: string
  year: number
  epi_week: number
  is_anomaly: boolean
}

export interface RecommendationScoreRow {
  department: string
  status: string
}

export interface RecommendationForecastRow {
  department: string
  horizon: number
  p50: number
}

export interface RecommendationDriverRow {
  department: string
  rank: number
  feature: string
  direction: string
}

export interface RecommendationInputs {
  series: readonly RecommendationSeriesRow[]
  anomalies: readonly RecommendationAnomalyRow[]
  scorecard: readonly RecommendationScoreRow[]
  forecasts: readonly RecommendationForecastRow[]
  drivers: readonly RecommendationDriverRow[]
}

export interface EpiWeek {
  year: number
  epi_week: number
}

export interface RecommendationItem {
  department: string
  level: AlertLevel
  recent_cases: number
  previous_cases: number
  change_pct: number | null
  forecast_cases: number | null
  forecast_change_pct: number | null
  recent_anomalies: number
  reasons: string[]
  actions: string[]
}

export interface RecommendationReport {
  overall_level: AlertLevel
  counts: Record<AlertLevel, number>
  window: { from: EpiWeek; to: EpiWeek } | null
  items: RecommendationItem[]
}

const LEVEL_ORDER: Readonly<Record<AlertLevel, number>> = { alto: 0, medio: 1, bajo: 2 }

// Indica si el tema de un dataset es dengue, sin importar mayúsculas ni tildes
export function isDengueTopic(topic: string): boolean {
  return topic.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().includes('dengue')
}

// Genera el reporte de alertas por lugar comparando 4 semanas recientes vs previas
export function buildRecommendations(
  inputs: RecommendationInputs,
  options: RecommendationOptions = DEFAULT_RECOMMENDATION_OPTIONS,
): RecommendationReport {
  const timeline = uniqueWeeks(inputs.series)
  const consolidated =
    timeline.length > PROVISIONAL_WEEKS + RECENT_WEEKS
      ? timeline.slice(0, -PROVISIONAL_WEEKS)
      : timeline
  const recentWeeks = consolidated.slice(-RECENT_WEEKS)
  const previousWeeks = consolidated.slice(-2 * RECENT_WEEKS, -RECENT_WEEKS)
  const lookback = new Set(timeline.slice(-ANOMALY_LOOKBACK_WEEKS).map(weekKey))

  const departments = [...new Set(inputs.series.map((row) => row.department))]
  const items = departments.map((department) =>
    buildItem(department, inputs, recentWeeks, previousWeeks, lookback, options),
  )
  items.sort(
    (left, right) =>
      LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level] ||
      right.recent_cases - left.recent_cases ||
      left.department.localeCompare(right.department),
  )

  const counts: Record<AlertLevel, number> = { alto: 0, medio: 0, bajo: 0 }
  for (const item of items) {
    counts[item.level] += 1
  }
  const overall: AlertLevel = counts.alto > 0 ? 'alto' : counts.medio > 0 ? 'medio' : 'bajo'
  const from = recentWeeks[0]
  const to = recentWeeks[recentWeeks.length - 1]

  return {
    overall_level: overall,
    counts,
    window: from && to ? { from, to } : null,
    items,
  }
}

// Calcula casos, pronóstico, anomalías, nivel, razones y acciones de un departamento
function buildItem(
  department: string,
  inputs: RecommendationInputs,
  recentWeeks: readonly EpiWeek[],
  previousWeeks: readonly EpiWeek[],
  lookback: ReadonlySet<string>,
  options: RecommendationOptions,
): RecommendationItem {
  const byWeek = new Map<string, number>()
  for (const row of inputs.series) {
    if (row.department === department) {
      byWeek.set(weekKey(row), (byWeek.get(weekKey(row)) ?? 0) + row.cases)
    }
  }
  const total = (weeks: readonly EpiWeek[]) => {
    if (options.aggregate === 'sum') {
      return weeks.reduce((sum, week) => sum + (byWeek.get(weekKey(week)) ?? 0), 0)
    }
    const values = weeks
      .map((week) => byWeek.get(weekKey(week)))
      .filter((value): value is number => value !== undefined)
    return values.length === 0
      ? 0
      : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 1000) / 1000
  }
  const recent = total(recentWeeks)
  const previous = total(previousWeeks)
  const minimum = options.aggregate === 'sum' ? MIN_CASES_FOR_CHANGE : 0
  const change = percentChange(previous, recent, minimum)

  const published = inputs.scorecard.some(
    (row) => row.department === department && row.status === PUBLISH,
  )
  const horizon = inputs.forecasts.filter(
    (row) => row.department === department && row.horizon <= RECENT_WEEKS,
  )
  const projected = horizon.reduce((sum, row) => sum + Math.max(0, row.p50), 0)
  const forecast =
    !published || horizon.length === 0
      ? null
      : options.aggregate === 'mean'
        ? Math.round((projected / horizon.length) * 1000) / 1000
        : Math.round(projected)
  const forecastChange = forecast === null ? null : percentChange(recent, forecast, minimum)

  const recentAnomalies = inputs.anomalies.filter(
    (row) => row.department === department && row.is_anomaly && lookback.has(weekKey(row)),
  ).length

  const magnitude = (value: number | null) =>
    value === null || options.direction === 'up' ? value : Math.abs(value)
  const level = alertLevel(magnitude(change), magnitude(forecastChange), recentAnomalies)

  return {
    department,
    level,
    recent_cases: recent,
    previous_cases: previous,
    change_pct: change,
    forecast_cases: forecast,
    forecast_change_pct: forecastChange,
    recent_anomalies: recentAnomalies,
    reasons:
      options.actions === 'dengue'
        ? reasons(recent, previous, change, forecast, forecastChange, recentAnomalies)
        : indicatorReasons(
            recent,
            previous,
            change,
            forecast,
            forecastChange,
            recentAnomalies,
            options,
          ),
    actions: actions(level, department, inputs.drivers, options.actions),
  }
}

// Nivel: alto si casos >=50 %, pronóstico >=25 % o anomalía con alza; medio si >=10 % o anomalía
export function alertLevel(
  change: number | null,
  forecastChange: number | null,
  recentAnomalies: number,
): AlertLevel {
  const rising = change ?? 0
  const forecastRising = forecastChange ?? 0
  if (rising >= 50 || forecastRising >= 25 || (recentAnomalies > 0 && rising > 0)) {
    return 'alto'
  }
  if (rising >= 10 || forecastRising >= 10 || recentAnomalies > 0) {
    return 'medio'
  }
  return 'bajo'
}

// Calcula el cambio porcentual redondeado o null si hay muy pocos casos
export function percentChange(
  before: number,
  after: number,
  minimum: number = MIN_CASES_FOR_CHANGE,
): number | null {
  if (Math.max(before, after) < minimum || (before === 0 && after === 0)) {
    return null
  }
  if (before === 0) {
    return 100
  }
  return Math.round(((after - before) / before) * 100)
}

// Redacta razones breves, un hecho por línea, sobre tendencia, anomalías y pronóstico
function reasons(
  recent: number,
  previous: number,
  change: number | null,
  forecast: number | null,
  forecastChange: number | null,
  recentAnomalies: number,
): string[] {
  const lines: string[] = []
  if (change === null) {
    lines.push('Muy pocos casos para medir una tendencia.')
  } else if (change >= 10) {
    lines.push(`Casos en alza: ${fmt(previous)} → ${fmt(recent)} (+${change} %).`)
  } else if (change <= -10) {
    lines.push(`Casos a la baja: ${fmt(previous)} → ${fmt(recent)} (${change} %).`)
  } else {
    lines.push(`Casos estables: ${fmt(recent)} en 4 semanas.`)
  }

  if (recentAnomalies > 0) {
    lines.push(
      recentAnomalies === 1
        ? '1 semana con más casos de lo esperado.'
        : `${recentAnomalies} semanas con más casos de lo esperado.`,
    )
  }

  if (forecast === null) {
    lines.push('Sin pronóstico confiable para este departamento.')
  } else if (forecastChange !== null && forecastChange >= 10) {
    lines.push(`Se esperan ~${fmt(forecast)} casos en 4 semanas (+${forecastChange} %).`)
  } else {
    lines.push(`Se esperan ~${fmt(forecast)} casos en 4 semanas.`)
  }
  return lines
}

// Redacta los motivos con el nombre del indicador, para cualquier tema que no sea dengue
function indicatorReasons(
  recent: number,
  previous: number,
  change: number | null,
  forecast: number | null,
  forecastChange: number | null,
  recentAnomalies: number,
  options: RecommendationOptions,
): string[] {
  const show = (value: number) =>
    options.aggregate === 'mean'
      ? value.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : fmt(value)
  const label = options.indicatorLabel
  const lines: string[] = []
  if (change === null) {
    lines.push('Muy pocos datos para medir una tendencia.')
  } else if (change >= 10) {
    lines.push(`${label} en alza: ${show(previous)} → ${show(recent)} (+${change} %).`)
  } else if (change <= -10) {
    lines.push(`${label} a la baja: ${show(previous)} → ${show(recent)} (${change} %).`)
  } else {
    lines.push(`${label} estable: ${show(recent)} en las últimas 4 semanas.`)
  }
  if (recentAnomalies > 0) {
    lines.push(
      recentAnomalies === 1
        ? '1 semana fuera de lo esperado.'
        : `${recentAnomalies} semanas fuera de lo esperado.`,
    )
  }
  if (forecast === null) {
    lines.push('Sin pronóstico confiable para este lugar.')
  } else {
    const rise = forecastChange !== null && forecastChange >= 10 ? ` (+${forecastChange} %)` : ''
    lines.push(`Se espera ~${show(forecast)} en las próximas 4 semanas${rise}.`)
  }
  return lines
}

// Elige acciones: la principal del nivel, la del factor al alza más fuerte y luego el resto
function actions(
  level: AlertLevel,
  department: string,
  drivers: readonly RecommendationDriverRow[],
  table: RecommendationOptions['actions'],
): string[] {
  const levelActions = table === 'dengue' ? LEVEL_ACTIONS : GENERAL_LEVEL_ACTIONS
  const driverActions = table === 'dengue' ? ACTION_TABLE : GENERAL_ACTION_TABLE
  const [main, ...rest] = levelActions[level]
  const chosen = main ? [main] : []
  if (level !== 'bajo') {
    const top = drivers
      .filter((row) => row.department === department && row.direction === 'up')
      .sort((left, right) => left.rank - right.rank)[0]
    const action = top ? driverActions[top.feature as Feature] : undefined
    if (action) {
      chosen.push(action)
    }
  }
  for (const action of rest) {
    if (!chosen.includes(action)) {
      chosen.push(action)
    }
  }
  return chosen.slice(0, MAX_ACTIONS)
}

// Devuelve las semanas epidemiológicas únicas ordenadas cronológicamente
function uniqueWeeks(rows: readonly EpiWeek[]): EpiWeek[] {
  const seen = new Map<string, EpiWeek>()
  for (const row of rows) {
    seen.set(weekKey(row), { year: row.year, epi_week: row.epi_week })
  }
  return [...seen.values()].sort(
    (left, right) => left.year - right.year || left.epi_week - right.epi_week,
  )
}

// Construye la clave "año-semana" de una semana epidemiológica
function weekKey(week: EpiWeek): string {
  return `${week.year}-${week.epi_week}`
}

// Formatea un número redondeado con el formato es-PE
function fmt(value: number): string {
  return Math.round(value).toLocaleString('es-PE')
}

export const LEVEL_LABELS: Readonly<Record<AlertLevel, string>> = {
  alto: 'Alerta alta',
  medio: 'Atención',
  bajo: 'Estable',
}

export interface RecommendationNarrativePayload {
  overall_level: string
  departments: Array<{
    department: string
    level: string
    reasons: string[]
    first_action: string
  }>
  five_year_trend: string | null
}

// Arma el payload agregado para el redactor de la narrativa (LLM o plantilla)
export function recommendationPayload(
  report: RecommendationReport,
  annualChangePct: number | null = null,
): RecommendationNarrativePayload {
  return {
    overall_level: LEVEL_LABELS[report.overall_level],
    departments: report.items.map((item) => ({
      department: item.department,
      level: LEVEL_LABELS[item.level],
      reasons: item.reasons,
      first_action: item.actions[0] ?? '',
    })),
    five_year_trend: annualChangePct === null ? null : trendPhrase(annualChangePct),
  }
}

// Genera titular y resumen deterministas para cuando no hay LLM disponible
export function renderRecommendationSummary(
  report: RecommendationReport,
  annualChangePct: number | null = null,
): { headline: string; text: string } {
  const names = (level: AlertLevel) =>
    report.items.filter((item) => item.level === level).map((item) => item.department)
  const high = names('alto')
  const medium = names('medio')

  const headline =
    high.length > 0
      ? `Actuar esta semana en ${listJoin(high)}`
      : medium.length > 0
        ? `Vigilar de cerca ${listJoin(medium)}`
        : 'Sin señales de alarma esta semana'

  const first = report.items[0]
  const parts: string[] = []
  if (first && first.level !== 'bajo' && first.actions[0]) {
    parts.push(`Primer paso en ${first.department}: ${lowerFirst(first.actions[0])}`)
  } else {
    parts.push('Todos los departamentos se mantienen estables.')
  }
  if (annualChangePct !== null) {
    parts.push(`A 5 años, ${trendPhrase(annualChangePct)}.`)
  }
  return { headline, text: parts.join(' ') }
}

// Describe la tendencia anual en una frase (estable si el cambio es menor a 3 %)
export function trendPhrase(annualChangePct: number): string {
  if (Math.abs(annualChangePct) < 3) {
    return 'los casos anuales se mantienen estables'
  }
  return annualChangePct > 0
    ? `los casos anuales crecen ~${annualChangePct} % por año`
    : `los casos anuales bajan ~${Math.abs(annualChangePct)} % por año`
}

// Une una lista con comas y "y" antes del último elemento
function listJoin(values: readonly string[]): string {
  if (values.length <= 1) {
    return values[0] ?? ''
  }
  return `${values.slice(0, -1).join(', ')} y ${values[values.length - 1]}`
}

// Pone en minúscula la primera letra del texto
function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1)
}
