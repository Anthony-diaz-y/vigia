import type { DatasetColumn, PlaceLevel, TimeKind } from './roles'

export type Indicator =
  { kind: 'records' } | { kind: 'sum'; column: string } | { kind: 'mean'; column: string }

export type Granularity = 'day' | 'week' | 'month' | 'year'

export type WidgetType =
  'kpis' | 'timeseries' | 'interannual' | 'ranking' | 'heatmap' | 'breakdown' | 'histogram'

export interface WidgetPlan {
  id: string
  type: WidgetType
  title: string
  column?: string
}

export interface DatasetFacts {
  columns: readonly DatasetColumn[]
  rows: number
  periods: number
  places: number
  years: number
  distinct: Readonly<Record<string, number>>
}

export interface IndicatorOption {
  id: string
  label: string
  indicator: Indicator
}

export interface GroupValue {
  name: string
  value: number
  count: number
}

const DAY_SPAN = 90
const WEEK_SPAN = 3 * 366
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_BARS = 10
const MAX_HEATMAP_PLACES = 40
const MIN_HISTOGRAM_VALUES = 5
const MAX_BREAKDOWNS = 6
const MAX_HISTOGRAMS = 3
const OTHERS = 'Otros'

const PLACE_PRIORITY: readonly PlaceLevel[] = [
  'department',
  'location',
  'province',
  'district',
  'ubigeo',
]

const LEVEL_NAMES: Readonly<Record<PlaceLevel, string>> = {
  department: 'departamento',
  location: 'departamento',
  province: 'provincia',
  district: 'distrito',
  ubigeo: 'código UBIGEO',
}

const GRANULARITY_NAMES: Readonly<Record<Granularity, string>> = {
  day: 'día',
  week: 'semana',
  month: 'mes',
  year: 'año',
}

// Nombre visible de una columna: su etiqueta en español o, si no tiene, su nombre original
export function columnLabel(column: DatasetColumn): string {
  return column.label.trim() || column.name
}

// Pasa a minúscula la primera letra para usar el nombre dentro de una frase
function inSentence(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

// Indicador por defecto: la suma de la cantidad si existe; si no, la cantidad de registros
export function defaultIndicator(columns: readonly DatasetColumn[]): Indicator {
  const count = columns.find((column) => column.role === 'count')
  return count ? { kind: 'sum', column: count.name } : { kind: 'records' }
}

// Indicadores que se pueden elegir: registros, total de la cantidad y promedio de cada valor medido
export function indicatorOptions(columns: readonly DatasetColumn[]): IndicatorOption[] {
  const options: IndicatorOption[] = [
    { id: 'records', label: 'Registros', indicator: { kind: 'records' } },
  ]
  for (const column of columns.filter((item) => item.role === 'count')) {
    options.push({
      id: `sum:${column.name}`,
      label: `Total de ${inSentence(columnLabel(column))}`,
      indicator: { kind: 'sum', column: column.name },
    })
  }
  for (const column of columns.filter((item) => item.role === 'measure')) {
    options.push({
      id: `mean:${column.name}`,
      label: `${columnLabel(column)} promedio`,
      indicator: { kind: 'mean', column: column.name },
    })
  }
  return options
}

// Identificador estable de un indicador para la URL y la caché
export function indicatorId(indicator: Indicator): string {
  return indicator.kind === 'records' ? 'records' : `${indicator.kind}:${indicator.column}`
}

// Nombre visible de un indicador
export function indicatorLabel(indicator: Indicator, columns: readonly DatasetColumn[]): string {
  const id = indicatorId(indicator)
  return indicatorOptions(columns).find((option) => option.id === id)?.label ?? 'Registros'
}

// Lee un indicador por su id; si no corresponde a una columna del dataset, usa el de por defecto
export function parseIndicator(
  id: string | undefined,
  columns: readonly DatasetColumn[],
): Indicator {
  const option = indicatorOptions(columns).find((item) => item.id === id)
  return option?.indicator ?? defaultIndicator(columns)
}

// Elige la granularidad de la serie: por rango de fechas, o la que dan las columnas de tiempo
export function chooseGranularity(
  time: TimeKind,
  first: string | null,
  last: string | null,
): Granularity | null {
  if (time === 'week' || time === 'month' || time === 'year') {
    return time
  }
  if (time !== 'date') {
    return null
  }
  const span = first && last ? (Date.parse(last) - Date.parse(first)) / DAY_MS : 0
  return span <= DAY_SPAN ? 'day' : span <= WEEK_SPAN ? 'week' : 'month'
}

// Columna de lugar para rankings y mapas: la de nivel más alto (la ubicación cuenta como departamento)
export function placeColumn(
  columns: readonly DatasetColumn[],
): { column: string; level: PlaceLevel } | null {
  for (const level of PLACE_PRIORITY) {
    const found = columns.find((column) => column.role === 'place' && column.level === level)
    if (found) {
      return { column: found.name, level: level === 'location' ? 'department' : level }
    }
  }
  return null
}

// Decide qué gráficos tiene sentido mostrar según los roles y la variedad de los datos
export function planWidgets(
  facts: DatasetFacts,
  indicator: Indicator,
  granularity: Granularity | null,
): WidgetPlan[] {
  const label = indicatorLabel(indicator, facts.columns)
  const place = placeColumn(facts.columns)
  const placeName = place ? LEVEL_NAMES[place.level] : ''
  const timeName = granularity ? GRANULARITY_NAMES[granularity] : ''
  const plan: WidgetPlan[] = [{ id: 'kpis', type: 'kpis', title: 'Indicadores clave' }]

  if (granularity && facts.periods >= 2) {
    plan.push({ id: 'timeseries', type: 'timeseries', title: `${label} por ${timeName}` })
  }
  if ((granularity === 'week' || granularity === 'month') && facts.years >= 2) {
    plan.push({
      id: 'interannual',
      type: 'interannual',
      title: `${label}: comparación entre años`,
    })
  }
  if (place && facts.places >= 2) {
    plan.push({
      id: 'ranking',
      type: 'ranking',
      title: `${label} por ${placeName}`,
      column: place.column,
    })
    const mappable = granularity && granularity !== 'year' && facts.periods >= 2
    if (mappable && facts.places <= MAX_HEATMAP_PLACES) {
      plan.push({
        id: 'heatmap',
        type: 'heatmap',
        title: `${label} por ${placeName} y ${timeName}`,
        column: place.column,
      })
    }
  }

  const categories = facts.columns
    .filter((column) => column.role === 'category' && (facts.distinct[column.name] ?? 0) >= 2)
    .sort((left, right) => (facts.distinct[left.name] ?? 0) - (facts.distinct[right.name] ?? 0))
    .slice(0, MAX_BREAKDOWNS)
  for (const column of categories) {
    plan.push({
      id: `breakdown:${column.name}`,
      type: 'breakdown',
      title: `${label} por ${inSentence(columnLabel(column))}`,
      column: column.name,
    })
  }

  const measures = facts.columns
    .filter(
      (column) =>
        column.role === 'measure' && (facts.distinct[column.name] ?? 0) >= MIN_HISTOGRAM_VALUES,
    )
    .slice(0, MAX_HISTOGRAMS)
  for (const column of measures) {
    plan.push({
      id: `histogram:${column.name}`,
      type: 'histogram',
      title: `Distribución de ${inSentence(columnLabel(column))}`,
      column: column.name,
    })
  }
  return plan
}

// Deja los 10 grupos más altos y junta el resto en "Otros" (promedio ponderado si el indicador es un promedio)
export function topWithOthers(
  rows: readonly GroupValue[],
  indicator: Indicator,
): { name: string; value: number }[] {
  const sorted = [...rows].sort((left, right) => right.value - left.value)
  const top = sorted.slice(0, MAX_BARS).map(({ name, value }) => ({ name, value }))
  const rest = sorted.slice(MAX_BARS)
  if (rest.length === 0) {
    return top
  }
  const value =
    indicator.kind === 'mean'
      ? rest.reduce((sum, row) => sum + row.value * row.count, 0) /
        Math.max(
          1,
          rest.reduce((sum, row) => sum + row.count, 0),
        )
      : rest.reduce((sum, row) => sum + row.value, 0)
  return [...top, { name: OTHERS, value }]
}
