import type { DatasetColumn, PlaceLevel, TimeKind } from './roles'
import { ubigeoHeaderLevel, type UbigeoLevel } from './ubigeo'

export type Indicator =
  { kind: 'records' } | { kind: 'sum'; column: string } | { kind: 'mean'; column: string }

export type Granularity = 'day' | 'week' | 'month' | 'year'

export type WidgetType =
  'kpis' | 'timeseries' | 'interannual' | 'ranking' | 'heatmap' | 'breakdown' | 'histogram'

export type BreakdownVariant = 'bars' | 'proportion' | 'dominant'

export interface WidgetPlan {
  id: string
  type: WidgetType
  title: string
  column?: string
  variant?: BreakdownVariant
}

export interface CategoryShape {
  values: number
  yesNo: boolean
  topShare: number
  topMissing: boolean
}

export interface DatasetFacts {
  columns: readonly DatasetColumn[]
  rows: number
  periods: number
  places: number
  years: number
  distinct: Readonly<Record<string, number>>
  categories?: Readonly<Record<string, CategoryShape>>
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
const MAX_COMPACT = 6
const MAX_HISTOGRAMS = 3
const CODE_NAME =
  /(^|[^a-z0-9])(cod|codigo|code|id|nro|numero|renaes|ubigeo)([^a-z0-9]|$)|c[oó]digo/i
const DOMINANT_SHARE = 0.9
const MAX_DOMINANT_VALUES = 5
const OTHERS_NAMES = ['Otros', 'Resto', 'Demás valores']

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
  ubigeo: 'ubicación',
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

// Columnas de lugar por nivel, de mayor a menor (una por nivel; el nombre gana al código)
export function placeColumns(
  columns: readonly DatasetColumn[],
): { column: string; level: PlaceLevel }[] {
  const found: { column: string; level: PlaceLevel }[] = []
  for (const level of PLACE_PRIORITY) {
    const same = columns.filter((column) => column.role === 'place' && column.level === level)
    const chosen = same.find((column) => !isCodeLike(column)) ?? same[0]
    if (chosen) {
      found.push({ column: chosen.name, level: level === 'location' ? 'department' : level })
    }
  }
  return found
}

// Columna de lugar para rankings y mapas: el nivel más alto que varía (si todos son constantes, el más alto)
export function placeColumn(
  columns: readonly DatasetColumn[],
  distinct: Readonly<Record<string, number>> = {},
): { column: string; level: PlaceLevel } | null {
  const found = placeColumns(columns)
  return found.find((place) => (distinct[place.column] ?? Infinity) >= 2) ?? found[0] ?? null
}

// Nivel de lugar de una categoría que en realidad es un código de departamento, provincia o distrito
export function categoryCodeLevel(column: DatasetColumn): UbigeoLevel | null {
  return ubigeoHeaderLevel(column.name) ?? ubigeoHeaderLevel(column.label)
}

// Indica si una categoría es un código (de red, provincia…) y no un nombre legible
function isCodeLike(column: DatasetColumn): boolean {
  return CODE_NAME.test(column.name) || CODE_NAME.test(column.label)
}

// Nombre de la columna dentro de una frase; si está todo en mayúsculas (NIVEL) lo pasa a minúsculas
function sentenceName(column: DatasetColumn): string {
  const label = columnLabel(column).replace(/_/g, ' ').trim()
  return label === label.toUpperCase() ? label.toLowerCase() : inSentence(label)
}

// Nombre de una columna sin etiqueta, legible como título: "Establecimiento priorizado 2024"
function humanize(text: string): string {
  const spaced = text.replace(/_/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

// Etiqueta propia de una columna; vacía si falta o solo repite el nombre del archivo
function plainLabel(column: DatasetColumn): string {
  const label = column.label.trim()
  return label.toLowerCase() === column.name.toLowerCase() ? '' : label
}

// Forma de mostrar una categoría: proporción (sí/no o dos valores), dominante (casi todo en uno) o barras
function breakdownVariant(
  shape: CategoryShape | undefined,
  indicator: Indicator,
): BreakdownVariant {
  if (!shape || indicator.kind === 'mean') {
    return 'bars'
  }
  if (shape.yesNo && shape.values === 2) {
    return 'proportion'
  }
  const dominant =
    shape.values >= 1 &&
    shape.values <= MAX_DOMINANT_VALUES &&
    shape.topShare >= DOMINANT_SHARE &&
    !shape.topMissing
  if (dominant) {
    return 'dominant'
  }
  return shape.values === 2 ? 'proportion' : 'bars'
}

// Decide qué gráficos tiene sentido mostrar según los roles y la variedad de los datos
export function planWidgets(
  facts: DatasetFacts,
  indicator: Indicator,
  granularity: Granularity | null,
): WidgetPlan[] {
  const label = indicatorLabel(indicator, facts.columns)
  const place = placeColumn(facts.columns, facts.distinct)
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

  // Los demás niveles de lugar que varían se desglosan (el constante no aporta)
  const named = placeColumns(facts.columns).filter((other) => other.level !== 'ubigeo')
  const levels = placeColumns(facts.columns)
    .filter(
      (other) =>
        other.column !== place?.column &&
        other.level !== place?.level &&
        // Un código de ubicación que repite un nombre de provincia o distrito no tiene gráfico propio
        !(other.level === 'ubigeo' && named.length > 0) &&
        (facts.distinct[other.column] ?? 0) >= 2,
    )
    .map((other) => ({ ...other, label: LEVEL_NAMES[other.level] }))
  // Con un lugar en el tablero, los códigos de departamento, provincia o distrito no se desglosan
  const candidates = facts.columns
    .filter(
      (column) =>
        column.role === 'category' &&
        (facts.distinct[column.name] ?? 0) >= 2 &&
        !(place && categoryCodeLevel(column)),
    )
    .sort(
      (left, right) =>
        Number(isCodeLike(left)) - Number(isCodeLike(right)) ||
        (facts.distinct[left.name] ?? 0) - (facts.distinct[right.name] ?? 0),
    )
    .map((column) => {
      const geography = categoryCodeLevel(column)
      const variant = geography
        ? 'bars'
        : breakdownVariant(facts.categories?.[column.name], indicator)
      return { column, geography, variant }
    })
  // Las tarjetas compactas son chicas: tienen su propio tope y no gastan el de barras
  const compact = candidates.filter((item) => item.variant !== 'bars').slice(0, MAX_COMPACT)
  const bars = candidates
    .filter((item) => item.variant === 'bars')
    .slice(0, Math.max(0, MAX_BREAKDOWNS - levels.length))
  const chosen = new Set([...compact, ...bars])
  for (const level of levels) {
    plan.push({
      id: `breakdown:${level.column}`,
      type: 'breakdown',
      title: `${label} por ${level.label}`,
      column: level.column,
    })
  }
  for (const { column, geography, variant } of candidates.filter((item) => chosen.has(item))) {
    if (variant !== 'bars') {
      plan.push({
        id: `breakdown:${column.name}`,
        type: 'breakdown',
        title: plainLabel(column) || humanize(column.name),
        column: column.name,
        variant,
      })
      continue
    }
    plan.push({
      id: `breakdown:${column.name}`,
      type: 'breakdown',
      title: `${label} por ${geography ? LEVEL_NAMES[geography] : sentenceName(column)}`,
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
  const taken = new Set(sorted.map((row) => row.name.trim().toLowerCase()))
  const name =
    OTHERS_NAMES.find((candidate) => !taken.has(candidate.toLowerCase())) ?? 'Otros (agrupados)'
  return [...top, { name, value }]
}
