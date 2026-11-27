import type { DashboardResponse, WidgetDto } from '@vigia/contracts'
import {
  chooseGranularity,
  categoryCodeLevel,
  displayValue,
  isMissingValue,
  MISSING_VALUE,
  cleanDepartment,
  epiWeekOf,
  indicatorId,
  indicatorLabel,
  indicatorOptions,
  placeColumn,
  placeColumns,
  planWidgets,
  resolveUbigeo,
  splitLocation,
  timeSupport,
  topWithOthers,
  ubigeoPlaceName,
  valueRules,
  type CategoryShape,
  type DatasetColumn,
  type Granularity,
  type Indicator,
  type PlaceLevel,
  type ValueRules,
  type WidgetPlan,
} from '@vigia/epidemiology'

import { findInsights } from './insights'

export type DataRow = Record<string, string | number | null>

export interface DashboardInput {
  title: string
  topic: string
  columns: DatasetColumn[]
  rows: DataRow[]
  indicator: Indicator
  year: number | null
}

const MAX_RANKING = 10
const MAX_HISTOGRAM_BINS = 20
const MAX_SINGLE_BIN_SHARE = 0.9
const MISSING = MISSING_VALUE
const TOTAL = 'Total'
const DAY_MS = 24 * 60 * 60 * 1000
const CODE_VALUE = /^\d+(?:\.0+)?$/

class Accumulator {
  records = 0
  sum = 0
  measured = 0

  // Suma una fila al acumulador según el indicador elegido
  add(row: DataRow, indicator: Indicator): void {
    this.records += 1
    if (indicator.kind === 'records') {
      return
    }
    const value = row[indicator.column]
    if (typeof value === 'number') {
      this.sum += value
      this.measured += 1
    }
  }

  // Valor final del indicador: conteo, suma o promedio redondeado a 3 decimales
  value(indicator: Indicator): number | null {
    if (indicator.kind === 'records') {
      return this.records
    }
    if (indicator.kind === 'sum') {
      return round(this.sum)
    }
    return this.measured === 0 ? null : round(this.sum / this.measured)
  }
}

// Redondea a 3 decimales para no arrastrar ruido de punto flotante
function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

// Agrupa filas por una clave y acumula el indicador en cada grupo
function groupBy(
  rows: readonly DataRow[],
  key: (row: DataRow) => string | null,
  indicator: Indicator,
): Map<string, Accumulator> {
  const groups = new Map<string, Accumulator>()
  for (const row of rows) {
    const name = key(row)
    if (name === null) {
      continue
    }
    const group = groups.get(name) ?? new Accumulator()
    group.add(row, indicator)
    groups.set(name, group)
  }
  return groups
}

// Formatea un número para los indicadores clave en español de Perú
function formatKpi(value: number | null, decimals = 0): string {
  return value === null
    ? '—'
    : value.toLocaleString('es-PE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
}

// Lee los años con datos de cada fila según la columna de tiempo disponible
export function rowYearReader(
  columns: readonly DatasetColumn[],
  epiYear = false,
): (row: DataRow) => number | null {
  const date = columns.find((column) => column.role === 'date')
  const year = columns.find((column) => column.role === 'year')
  return (row) => {
    if (date) {
      const value = row[date.name]
      if (typeof value !== 'string') {
        return null
      }
      return epiYear ? epiYearOf(value) : Number(value.slice(0, 4))
    }
    const value = year ? row[year.name] : null
    return typeof value === 'number' ? Math.trunc(value) : null
  }
}

// Años con datos de un dataset, del más reciente al más antiguo
export function datasetYears(
  columns: readonly DatasetColumn[],
  rows: readonly DataRow[],
  epiYear = false,
): number[] {
  const yearOf = rowYearReader(columns, epiYear)
  const years = new Set<number>()
  for (const row of rows) {
    const year = yearOf(row)
    if (year !== null) {
      years.add(year)
    }
  }
  return [...years].sort((left, right) => right - left)
}

// Clave del periodo de una fila según la granularidad (día, semana epidemiológica, mes o año)
function periodReader(
  columns: readonly DatasetColumn[],
  granularity: Granularity | null,
): (row: DataRow) => string | null {
  const byRole = (role: DatasetColumn['role']) => columns.find((column) => column.role === role)
  const date = byRole('date')
  const year = byRole('year')
  const week = byRole('week')
  const month = byRole('month')
  const pad = (value: number) => String(value).padStart(2, '0')
  return (row) => {
    if (!granularity) {
      return null
    }
    if (date) {
      const value = row[date.name]
      if (typeof value !== 'string') {
        return null
      }
      if (granularity === 'day') {
        return value
      }
      if (granularity === 'week') {
        const parts = epiWeekOf(new Date(`${value}T00:00:00Z`))
        return `${parts.year}-S${pad(parts.epi_week)}`
      }
      return granularity === 'month' ? value.slice(0, 7) : value.slice(0, 4)
    }
    const y = year ? row[year.name] : null
    if (typeof y !== 'number') {
      return null
    }
    const part =
      granularity === 'week' ? (week ? row[week.name] : null) : month ? row[month.name] : null
    if (granularity === 'year') {
      return String(y)
    }
    return typeof part === 'number' ? `${y}-${granularity === 'week' ? 'S' : ''}${pad(part)}` : null
  }
}

// Traduce un código UBIGEO a su nombre; si el valor no es un código o no está en el catálogo, devuelve null
function codeName(text: string): string | null {
  return CODE_VALUE.test(text.trim()) ? ubigeoPlaceName(text) : null
}

// Lugar de una fila con el nivel principal: el más alto que varía según los datos, si se conocen
function placeReader(
  columns: readonly DatasetColumn[],
  distinct?: Readonly<Record<string, number>>,
): ((row: DataRow) => string | null) | null {
  const place = placeColumn(columns, distinct)
  return place ? columnPlaceReader(columns, place) : null
}

// Lugar de una fila en una columna de lugar: la ubicación combinada se reduce a su departamento
function columnPlaceReader(
  columns: readonly DatasetColumn[],
  place: { column: string; level: PlaceLevel },
): (row: DataRow) => string | null {
  const source = columns.find((column) => column.name === place.column)
  return (row) => {
    const value = row[place.column]
    if (typeof value !== 'string' && typeof value !== 'number') {
      return null
    }
    const text = String(value)
    if (source?.level === 'location') {
      return splitLocation(text).department || null
    }
    if (place.level === 'department') {
      const department = CODE_VALUE.test(text.trim()) ? resolveUbigeo(text) : null
      return cleanDepartment(department ?? text)
    }
    return (codeName(text) ?? text.trim()).toUpperCase()
  }
}

// Siguiente semana epidemiológica, pasando a la semana 1 del año siguiente al terminar el año
function nextWeek(year: number, week: number): [number, number] {
  return week < weeksInYear(year) ? [year, week + 1] : [year + 1, 1]
}

// Cantidad de semanas epidemiológicas de un año (52 o 53)
function weeksInYear(year: number): number {
  const last = epiWeekOf(new Date(Date.UTC(year, 11, 31)))
  return last.year === year ? last.epi_week : epiWeekOf(new Date(Date.UTC(year, 11, 24))).epi_week
}

// Lista todos los periodos entre el primero y el último, incluidos los que no tienen datos
export function periodRange(first: string, last: string, granularity: Granularity): string[] {
  const pad = (value: number) => String(value).padStart(2, '0')
  const periods: string[] = []
  if (granularity === 'week') {
    let [year, week] = first.split('-S').map(Number) as [number, number]
    for (let key = first; key <= last; key = `${year}-S${pad(week)}`) {
      periods.push(key)
      ;[year, week] = nextWeek(year, week)
    }
    return periods
  }
  if (granularity === 'day') {
    for (let time = Date.parse(first); time <= Date.parse(last); time += DAY_MS) {
      periods.push(new Date(time).toISOString().slice(0, 10))
    }
    return periods
  }
  if (granularity === 'month') {
    let [year, month] = first.split('-').map(Number) as [number, number]
    for (let key = first; key <= last; key = `${year}-${pad(month)}`) {
      periods.push(key)
      ;[year, month] = month === 12 ? [year + 1, 1] : [year, month + 1]
    }
    return periods
  }
  for (let year = Number(first); year <= Number(last); year += 1) {
    periods.push(String(year))
  }
  return periods
}

// Serie completa: los huecos dentro de años con datos valen 0 en conteos; los años sin datos quedan vacíos
function filledSeries(
  periods: Map<string, Accumulator>,
  indicator: Indicator,
  granularity: Granularity | null,
): { period: string; value: number | null }[] {
  const keys = [...periods.keys()].sort()
  if (!granularity || keys.length === 0) {
    return []
  }
  const years = new Set(keys.map((key) => key.slice(0, 4)))
  return periodRange(keys[0]!, keys.at(-1)!, granularity).map((period) => {
    const group = periods.get(period)
    if (group) {
      return { period, value: group.value(indicator) }
    }
    const zero = indicator.kind !== 'mean' && years.has(period.slice(0, 4))
    return { period, value: zero ? 0 : null }
  })
}

// Serie del tablero con la granularidad elegida
function timeseries(context: WidgetContext): { period: string; value: number | null }[] {
  return filledSeries(context.periods, context.indicator, context.granularity)
}

// Serie completa del indicador a una granularidad dada, para pronosticar
export function indicatorSeries(
  columns: readonly DatasetColumn[],
  rows: readonly DataRow[],
  indicator: Indicator,
  granularity: Granularity,
): { period: string; value: number | null }[] {
  const periods = groupBy(rows, periodReader(columns, granularity), indicator)
  return filledSeries(periods, indicator, granularity)
}

// Serie semanal del indicador por lugar (departamento o departamento y provincia); "Total" sin lugar
export function weeklyIndicatorRows(
  columns: readonly DatasetColumn[],
  rows: readonly DataRow[],
  indicator: Indicator,
  level: 'department' | 'province',
): { department: string; province?: string; year: number; epi_week: number; cases: number }[] {
  const periodOf = periodReader(columns, 'week')
  const departmentOf = placeReader(columns)
  const province = columns.find((column) => column.role === 'place' && column.level === 'province')
  const location = columns.find((column) => column.role === 'place' && column.level === 'location')
  const provinceOf = (row: DataRow): string => {
    if (province) {
      const text = String(row[province.name] ?? '').trim()
      return (codeName(text) ?? text).toUpperCase()
    }
    const text = location ? row[location.name] : null
    return typeof text === 'string' ? splitLocation(text).province : ''
  }
  const groups = groupBy(
    rows,
    (row) => {
      const period = periodOf(row)
      if (!period) {
        return null
      }
      const department = departmentOf ? departmentOf(row) : TOTAL
      if (!department) {
        return null
      }
      return JSON.stringify([department, level === 'province' ? provinceOf(row) : '', period])
    },
    indicator,
  )
  return [...groups.entries()]
    .filter(([, group]) => group.value(indicator) !== null)
    .map(([key, group]) => {
      const [department, provinceName, period] = JSON.parse(key) as [string, string, string]
      const [year, week] = period.split('-S').map(Number) as [number, number]
      return {
        department,
        ...(level === 'province' ? { province: provinceName } : {}),
        year,
        epi_week: week,
        cases: group.value(indicator)!,
      }
    })
    .sort(
      (left, right) =>
        left.department.localeCompare(right.department) ||
        (left.province ?? '').localeCompare(right.province ?? '') ||
        left.year - right.year ||
        left.epi_week - right.epi_week,
    )
}

// Granularidad para pronosticar: semanas si hay fechas o semanas, meses si solo hay meses
export function forecastGranularity(
  columns: readonly DatasetColumn[],
  rows: readonly DataRow[],
): 'week' | 'month' | null {
  const time = timeSupport(columns)
  if (time === 'week' || time === 'month') {
    return time
  }
  const date = columns.find((column) => column.role === 'date')
  if (time !== 'date' || !date) {
    return null
  }
  const dates = rows
    .map((row) => row[date.name])
    .filter((value): value is string => typeof value === 'string')
    .sort()
  const granularity = chooseGranularity('date', dates[0] ?? null, dates.at(-1) ?? null)
  return granularity === 'month' ? 'month' : 'week'
}

// Periodo siguiente a uno dado, para rotular los periodos pronosticados
export function nextPeriod(period: string, granularity: 'week' | 'month'): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  if (granularity === 'week') {
    const [year, week] = period.split('-S').map(Number) as [number, number]
    const [nextYear, nextWeekNumber] = nextWeek(year, week)
    return `${nextYear}-S${pad(nextWeekNumber)}`
  }
  const [year, month] = period.split('-').map(Number) as [number, number]
  return month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`
}

// Año epidemiológico de una fecha ISO: el año del miércoles de su semana (domingo a sábado)
export function epiYearOf(iso: string): number {
  return epiWeekOf(new Date(`${iso.slice(0, 10)}T00:00:00Z`)).year
}

// Con fechas agrupadas por semana el año es el epidemiológico, igual que en Análisis
export function usesEpiYear(columns: readonly DatasetColumn[], granularity: Granularity | null) {
  return granularity === 'week' && columns.some((column) => column.role === 'date')
}

// Columna del dataset por nombre (la de lugar siempre existe)
function columnOf(columns: readonly DatasetColumn[], name: string): DatasetColumn {
  return columns.find((column) => column.name === name) as DatasetColumn
}

// Reglas para mostrar los valores de una categoría, según todos los valores de la columna
function categoryRules(column: DatasetColumn, rows: readonly DataRow[]): ValueRules {
  const values = new Set<string>()
  for (const row of rows) {
    const value = row[column.name]
    if (value !== null && value !== undefined) {
      values.add(String(value))
    }
  }
  return valueRules(column.name, [...values])
}

// Lee el valor a mostrar de una categoría: UBIGEO con nombre, "Sí"/"No" o "Sin dato" cuando corresponde
function categoryReader(column: DatasetColumn, rules: ValueRules): (row: DataRow) => string {
  const geography = categoryCodeLevel(column) !== null
  return (row) => {
    const value = row[column.name]
    if (value === null || value === undefined) {
      return MISSING
    }
    const text = String(value)
    return (geography ? codeName(text)?.toUpperCase() : null) ?? displayValue(text, rules)
  }
}

// Forma de una categoría (cuántos valores, qué tanto pesa el mayor); null si el indicador es un promedio
function categoryShape(
  groups: Map<string, Accumulator>,
  indicator: Indicator,
  rules: ValueRules,
): CategoryShape | null {
  if (indicator.kind === 'mean') {
    return null
  }
  const entries = [...groups.entries()].map(([name, group]) => ({
    name,
    value: group.value(indicator) ?? 0,
  }))
  const total = entries.reduce((sum, entry) => sum + entry.value, 0)
  const top = entries.reduce<(typeof entries)[number] | null>(
    (best, entry) => (best === null || entry.value > best.value ? entry : best),
    null,
  )
  if (!top || total <= 0) {
    return null
  }
  return {
    values: entries.filter((entry) => !isMissingValue(entry.name)).length,
    yesNo: rules.yesNo,
    topShare: top.value / total,
    topMissing: isMissingValue(top.name),
  }
}

// Arma el tablero completo: decide los widgets y calcula los datos de cada uno
export function buildDashboard(input: DashboardInput): DashboardResponse {
  const { columns, rows, indicator } = input
  const time = timeSupport(columns)
  const dateColumn = columns.find((column) => column.role === 'date')
  const dates = dateColumn
    ? rows
        .map((row) => row[dateColumn.name])
        .filter((value): value is string => typeof value === 'string')
        .sort()
    : []
  const granularity = chooseGranularity(time, dates[0] ?? null, dates.at(-1) ?? null)
  const epiYear = usesEpiYear(columns, granularity)
  const years = datasetYears(columns, rows, epiYear)
  const year = input.year !== null && years.includes(input.year) ? input.year : (years[0] ?? null)
  const yearOf = rowYearReader(columns, epiYear)
  const filtered = year === null ? rows : rows.filter((row) => yearOf(row) === year)
  const periodOf = periodReader(columns, granularity)

  const periods = groupBy(rows, periodOf, indicator)
  const distinct: Record<string, number> = {}
  // Valores distintos de cada nivel de lugar, ya traducidos a nombres
  for (const place of placeColumns(columns)) {
    const read = columnPlaceReader(columns, place)
    // Un "DESCONOCIDO" o 999999 no es un lugar más: no cuenta para elegir el lugar principal
    const missing = categoryRules(columnOf(columns, place.column), rows).missing
    distinct[place.column] = new Set(
      filtered
        .filter((row) => !missing.has(String(row[place.column] ?? '').trim()))
        .map(read)
        .filter((value) => value !== null),
    ).size
  }
  const rules = new Map<string, ValueRules>()
  const shapes: Record<string, CategoryShape> = {}
  for (const column of columns) {
    if (column.role === 'category') {
      const rule = categoryRules(column, rows)
      rules.set(column.name, rule)
      const groups = groupBy(filtered, categoryReader(column, rule), indicator)
      distinct[column.name] = groups.size
      if (!placeColumns(columns).some((place) => place.column === column.name)) {
        const shape = categoryShape(groups, indicator, rule)
        if (shape) {
          shapes[column.name] = shape
        }
      }
    } else if (column.role === 'measure') {
      distinct[column.name] = new Set(
        filtered.map((row) => row[column.name]).filter((value) => value !== null),
      ).size
    }
  }

  const placeOf = placeReader(columns, distinct)
  const places = placeOf ? groupBy(filtered, placeOf, indicator) : new Map<string, Accumulator>()
  const plan = planWidgets(
    {
      columns,
      rows: filtered.length,
      periods: periods.size,
      places: places.size,
      years: years.length,
      distinct,
      categories: shapes,
    },
    indicator,
    granularity,
  )
  const context = {
    input,
    indicator,
    filtered,
    periods,
    places,
    periodOf,
    placeOf,
    year,
    dates,
    granularity,
    rules,
  }

  const widgets = plan
    .map((widget) => buildWidget(widget, context))
    .filter((widget): widget is WidgetDto => widget !== null)
  const label = indicatorLabel(indicator, columns)
  return {
    title: input.title,
    topic: input.topic,
    indicator: { id: indicatorId(indicator), label },
    indicators: indicatorOptions(columns).map(({ id, label }) => ({ id, label })),
    granularity,
    years,
    widgets,
    insights: findInsights(widgets, indicator, label),
  }
}

interface WidgetContext {
  input: DashboardInput
  indicator: Indicator
  filtered: DataRow[]
  periods: Map<string, Accumulator>
  places: Map<string, Accumulator>
  periodOf: (row: DataRow) => string | null
  placeOf: ((row: DataRow) => string | null) | null
  year: number | null
  dates: string[]
  granularity: Granularity | null
  rules: Map<string, ValueRules>
}

// Ordena grupos de mayor a menor valor y, si empatan, por nombre
function sortedGroups(groups: Map<string, Accumulator>, indicator: Indicator) {
  return [...groups.entries()]
    .map(([name, group]) => ({ name, value: group.value(indicator) ?? 0, count: group.records }))
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name))
}

// Columna de texto mínima para desglosar por un nombre que no está entre las columnas
function fallbackColumn(name: string): DatasetColumn {
  return { name, label: '', role: 'category', level: null, field: null, kind: 'text' }
}

// Agrupa los valores bajos en "Otros" pero deja el "Sin dato" siempre al final
function missingLast(
  groups: ReturnType<typeof sortedGroups>,
  indicator: Indicator,
): { name: string; value: number }[] {
  const missing = groups.filter((group) => isMissingValue(group.name))
  const rows = topWithOthers(
    groups.filter((group) => !isMissingValue(group.name)),
    indicator,
  )
  return [...rows, ...missing.map(({ name, value }) => ({ name, value }))]
}

// Agrega la etiqueta del código cuando el usuario o la IA le dieron un significado
function withLabel(
  row: { name: string; value: number },
  labels: Readonly<Record<string, string>>,
): { name: string; value: number; label?: string } {
  const label = isMissingValue(row.name) ? undefined : labels[row.name]
  return label ? { ...row, label } : row
}

// Calcula los datos de un widget planeado
function buildWidget(widget: WidgetPlan, context: WidgetContext): WidgetDto | null {
  const { indicator, filtered } = context
  const base = { id: widget.id, title: widget.title }
  switch (widget.type) {
    case 'kpis':
      return { ...base, type: 'kpis', items: kpis(context) }
    case 'timeseries':
      return {
        ...base,
        type: 'timeseries',
        points: timeseries(context),
      }
    case 'interannual':
      return { ...base, type: 'interannual', ...interannual(context) }
    case 'ranking':
      return {
        ...base,
        type: 'ranking',
        rows: sortedGroups(context.places, indicator)
          .slice(0, MAX_RANKING)
          .map(({ name, value }) => ({ name, value })),
      }
    case 'heatmap':
      return { ...base, type: 'heatmap', ...heatmap(context) }
    case 'breakdown': {
      const column = widget.column ?? ''
      const source = context.input.columns.find((item) => item.name === column)
      const level = placeColumns(context.input.columns).find((item) => item.column === column)
      const readPlace = level ? columnPlaceReader(context.input.columns, level) : null
      const rules = context.rules.get(column)
      const read =
        readPlace && !rules
          ? (row: DataRow) => readPlace(row) ?? MISSING
          : categoryReader(source ?? fallbackColumn(column), rules ?? valueRules(column, []))
      const rows = missingLast(
        sortedGroups(groupBy(filtered, read, indicator), indicator),
        indicator,
      )
      return {
        ...base,
        type: 'breakdown',
        ...(widget.variant && widget.variant !== 'bars' ? { variant: widget.variant } : {}),
        rows: source?.values ? rows.map((row) => withLabel(row, source.values ?? {})) : rows,
      }
    }
    case 'histogram': {
      const bins = histogram(filtered, widget.column ?? '')
      return informative(bins) ? { ...base, type: 'histogram', bins } : null
    }
  }
}

// Indicadores clave: registros, valor del indicador, lugares y periodo cubierto
function kpis(context: WidgetContext) {
  const { input, indicator, filtered, places, year, dates } = context
  const total = new Accumulator()
  for (const row of filtered) {
    total.add(row, indicator)
  }
  const scope = year === null ? null : `en ${year}`
  const items = [{ label: 'Registros', value: formatKpi(filtered.length), hint: scope }]
  if (indicator.kind !== 'records') {
    items.push({
      label: indicatorLabel(indicator, input.columns),
      value: formatKpi(total.value(indicator), indicator.kind === 'mean' ? 1 : 0),
      hint: indicator.kind === 'mean' ? 'promedio de los registros' : scope,
    })
  }
  if (context.placeOf) {
    items.push({
      label: 'Lugares',
      value: formatKpi(places.size),
      hint: 'con al menos un registro',
    })
  }
  if (dates.length > 0) {
    const show = (iso: string) => iso.split('-').reverse().join('/')
    items.push({
      label: 'Periodo',
      value: `${show(dates[0]!)} – ${show(dates.at(-1)!)}`,
      hint: 'primera y última fecha',
    })
  }
  return items
}

// Comparación entre años: una fila por semana o mes y una columna por año
function interannual(context: WidgetContext) {
  const { input, indicator, periodOf } = context
  const byYear = new Map<string, Map<number, Accumulator>>()
  for (const row of input.rows) {
    const period = periodOf(row)
    const match = period ? /^(\d{4})-S?(\d{2})$/.exec(period) : null
    if (!match) {
      continue
    }
    const index = Number(match[2])
    const year = byYear.get(match[1]!) ?? new Map<number, Accumulator>()
    const group = year.get(index) ?? new Accumulator()
    group.add(row, indicator)
    year.set(index, group)
    byYear.set(match[1]!, year)
  }
  const years = [...byYear.keys()].sort()
  const last = context.granularity === 'month' ? 12 : 53
  const rows = Array.from({ length: last }, (_, offset) => {
    const index = offset + 1
    const row: Record<string, number | null> = { index }
    for (const year of years) {
      row[year] = byYear.get(year)?.get(index)?.value(indicator) ?? null
    }
    return row
  })
  return { years, rows }
}

// Mapa de calor: lugares (los de más valor primero) por periodo del año elegido
function heatmap(context: WidgetContext) {
  const { indicator, filtered, places, periodOf, placeOf } = context
  const rows = sortedGroups(places, indicator).map((group) => group.name)
  const cells = new Map<string, Accumulator>()
  const columns = new Set<string>()
  for (const row of filtered) {
    const place = placeOf?.(row)
    const period = periodOf(row)
    if (!place || !period) {
      continue
    }
    columns.add(period)
    const key = `${place}|${period}`
    const cell = cells.get(key) ?? new Accumulator()
    cell.add(row, indicator)
    cells.set(key, cell)
  }
  const ordered = [...columns].sort()
  return {
    rows,
    columns: ordered,
    values: rows.map((place) =>
      ordered.map((period) => cells.get(`${place}|${period}`)?.value(indicator) ?? null),
    ),
  }
}

// Indica si un histograma dice algo: no sirve cuando casi todos los valores caen en un mismo intervalo
function informative(bins: readonly { count: number }[]): boolean {
  const total = bins.reduce((sum, bin) => sum + bin.count, 0)
  const peak = bins.reduce((high, bin) => Math.max(high, bin.count), 0)
  return total > 0 && peak / total < MAX_SINGLE_BIN_SHARE
}

// Histograma de un valor medido con hasta 20 intervalos iguales
function histogram(rows: readonly DataRow[], column: string) {
  const values = rows
    .map((row) => row[column])
    .filter((value): value is number => typeof value === 'number')
  if (values.length === 0) {
    return []
  }
  const min = values.reduce((low, value) => Math.min(low, value), Infinity)
  const max = values.reduce((high, value) => Math.max(high, value), -Infinity)
  const count = Math.min(MAX_HISTOGRAM_BINS, new Set(values).size)
  const width = max === min ? 1 : (max - min) / count
  const bins = Array.from({ length: count }, (_, index) => ({
    from: round(min + index * width),
    to: round(min + (index + 1) * width),
    count: 0,
  }))
  for (const value of values) {
    const index = Math.min(count - 1, Math.floor((value - min) / width))
    bins[index]!.count += 1
  }
  return bins
}
