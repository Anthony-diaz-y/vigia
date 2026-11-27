import {
  chooseGranularity,
  columnLabel,
  defaultIndicator,
  indicatorOptions,
  placeColumn,
  planWidgets,
  type DatasetFacts,
  type IndicatorOption,
  type WidgetPlan,
  type WidgetType,
} from './dashboard'
import { isWholeCount, looksLikeCountName } from './count-name'
import { timeSupport, type ColumnKind, type ColumnRole, type DatasetColumn } from './roles'

export interface SummaryWidget {
  id: string
  type: WidgetType | 'indicators' | 'forecast'
  title: string
  detail: string
  columns: string[]
  tags: string[]
}

export interface DashboardSummary {
  widgets: SummaryWidget[]
  indicators: IndicatorOption[]
  forecast: boolean
  usable: boolean
  warnings: string[]
}

const UNUSED_ROLES: ReadonlySet<ColumnRole> = new Set(['identifier', 'ignore'])
const TIME_ROLES: ReadonlySet<ColumnRole> = new Set(['date', 'year', 'week', 'month'])
const VARIED = 5

const NO_TIME = 'Sin una columna de tiempo no habrá evolución ni pronóstico.'
const PARTIAL_TIME =
  'Para ver la evolución hace falta una fecha, o un año junto con una semana o un mes.'
const NO_PLACE = 'Sin una columna de lugar no habrá ranking por zona.'
const NO_COUNT = 'Sin una columna de cantidad, cada fila cuenta como un registro.'

// Elige el rol con el que se enciende una columna: un entero con nombre de cantidad se suma
export function turnOnRole(
  kind: ColumnKind,
  hint?: { name: string; label?: string; samples?: readonly string[] },
): ColumnRole {
  if (kind === 'number') {
    const count =
      hint !== undefined &&
      looksLikeCountName(hint.name, hint.label) &&
      isWholeCount(hint.samples ?? [])
    return count ? 'count' : 'measure'
  }
  return kind === 'date' ? 'date' : 'category'
}

// Columnas que dan el tiempo al tablero, según el tipo de tiempo que la API reconoce
function timeColumns(columns: readonly DatasetColumn[]): DatasetColumn[] {
  const time = timeSupport(columns)
  const wanted: ColumnRole[] =
    time === 'date'
      ? ['date']
      : time === 'week'
        ? ['year', 'week']
        : time === 'month'
          ? ['year', 'month']
          : time === 'year'
            ? ['year']
            : []
  return wanted.flatMap((role) => columns.filter((column) => column.role === role).slice(0, 1))
}

// Texto «A» y «B» con los nombres visibles de las columnas
function quoted(columns: readonly DatasetColumn[]): string {
  return columns.map((column) => `«${columnLabel(column)}»`).join(' y ')
}

// Agrega el detalle y las columnas de un gráfico planeado por la API
function describe(plan: WidgetPlan, columns: readonly DatasetColumn[]): SummaryWidget {
  const time = timeColumns(columns)
  const byName = (name?: string) => columns.filter((column) => column.name === name)
  const base = { id: plan.id, type: plan.type, title: plan.title, tags: [] as string[] }
  switch (plan.type) {
    case 'kpis':
      return { ...base, detail: 'Registros, lugares y periodo cubierto.', columns: [] }
    case 'timeseries':
      return {
        ...base,
        columns: time.map((column) => column.name),
        detail:
          timeSupport(columns) === 'date'
            ? `Usa ${quoted(time)}; agrupa por día, semana o mes según el rango.`
            : `Usa ${quoted(time)}.`,
      }
    case 'interannual':
      return {
        ...base,
        columns: time.map((column) => column.name),
        detail: 'Compara cada semana o mes entre años, si hay datos de más de uno.',
      }
    case 'ranking':
      return {
        ...base,
        columns: byName(plan.column).map((column) => column.name),
        detail: `Usa ${quoted(byName(plan.column))}.`,
      }
    case 'heatmap':
      return {
        ...base,
        columns: [...byName(plan.column), ...time].map((column) => column.name),
        detail: 'Cruza lugar y periodo para ver dónde y cuándo se concentra.',
      }
    case 'breakdown':
      return {
        ...base,
        columns: byName(plan.column).map((column) => column.name),
        detail: `Separa los resultados por ${quoted(byName(plan.column))}.`,
      }
    case 'histogram':
      return {
        ...base,
        columns: byName(plan.column).map((column) => column.name),
        detail: `Muestra cómo se reparten los valores de ${quoted(byName(plan.column))}.`,
      }
  }
}

// Resume qué tablero armará la API con estos roles, usando su misma decisión de gráficos
export function summarizeDashboard(columns: readonly DatasetColumn[]): DashboardSummary {
  const usable = columns.some((column) => !UNUSED_ROLES.has(column.role))
  if (!usable) {
    return { widgets: [], indicators: [], forecast: false, usable, warnings: [] }
  }
  const time = timeSupport(columns)
  const roles = new Set(columns.map((column) => column.role))
  const indicator = defaultIndicator(columns)
  const granularity = time === 'date' ? 'month' : chooseGranularity(time, null, null)
  const facts: DatasetFacts = {
    columns,
    rows: 2,
    periods: 2,
    places: 2,
    years: 2,
    distinct: Object.fromEntries(columns.map((column) => [column.name, VARIED])),
  }
  const plan = planWidgets(facts, indicator, granularity)
  const options = indicatorOptions(columns)
  const forecast = time === 'date' || time === 'week' || time === 'month'

  const widgets = plan.map((item) => {
    const widget = describe(item, columns)
    // Con fecha la API elige día, semana o mes según el rango, que aquí no se conoce
    return time === 'date'
      ? {
          ...widget,
          title: widget.title
            .replace(/ por mes$/, ' en el tiempo')
            .replace(/ y mes$/, ' y periodo'),
        }
      : widget
  })
  if (options.length > 1) {
    widgets.push({
      id: 'indicators',
      type: 'indicators',
      title: 'Indicadores para elegir',
      detail: 'En el tablero podrás cambiar qué se mide.',
      columns: columns
        .filter((column) => column.role === 'measure' || column.role === 'count')
        .map((column) => column.name),
      tags: options.map((option) => option.label),
    })
  }
  if (forecast) {
    const unit = time === 'month' ? 'meses' : time === 'week' ? 'semanas' : 'semanas o meses'
    widgets.push({
      id: 'forecast',
      type: 'forecast',
      title: 'Pronóstico',
      detail: `Estima los próximos ${unit} a partir de la evolución.`,
      columns: timeColumns(columns).map((column) => column.name),
      tags: [],
    })
  }

  const warnings: string[] = []
  if (time === 'none') {
    warnings.push([...TIME_ROLES].some((role) => roles.has(role)) ? PARTIAL_TIME : NO_TIME)
  }
  if (!placeColumn(columns)) {
    warnings.push(NO_PLACE)
  }
  if (!roles.has('count')) {
    warnings.push(NO_COUNT)
  }
  return { widgets, indicators: options, forecast, usable, warnings }
}
