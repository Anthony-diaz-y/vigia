import type {
  AnomalyRow,
  GeoLevel,
  HeatmapResponse,
  InterannualRow,
  RankingRow,
  WeeklySeriesRow,
} from '@vigia/contracts'

export const DEFAULT_ANOMALY_THRESHOLD = 3.5
export const MAD_SCALE = 0.6745

export type Aggregate = 'sum' | 'mean'

// Devuelve las columnas geográficas que agrupan según el nivel
export function geographyColumns(level: GeoLevel): readonly string[] {
  return level === 'department' ? ['department'] : ['department', 'province']
}

// Pivotea los casos por semana epidemiológica con una columna por año
export function buildInterannual(
  rows: readonly WeeklySeriesRow[],
  level: GeoLevel,
  geography?: string,
  aggregate: Aggregate = 'sum',
): InterannualRow[] {
  const filtered =
    geography === undefined
      ? rows
      : rows.filter((row) => geographyValue(row, level) === geography.trim().toUpperCase())

  const totals = new Map<number, Map<number, number>>()
  const counts = new Map<string, number>()
  const years = new Set<number>()
  for (const row of filtered) {
    years.add(row.year)
    let byYear = totals.get(row.epi_week)
    if (!byYear) {
      byYear = new Map()
      totals.set(row.epi_week, byYear)
    }
    byYear.set(row.year, (byYear.get(row.year) ?? 0) + row.cases)
    const key = `${row.epi_week}-${row.year}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (aggregate === 'mean') {
    for (const [week, byYear] of totals) {
      for (const [year, total] of byYear) {
        byYear.set(year, roundValue(total / (counts.get(`${week}-${year}`) ?? 1)))
      }
    }
  }

  const orderedYears = [...years].sort((left, right) => left - right)
  return [...totals.keys()]
    .sort((left, right) => left - right)
    .map((week) => {
      const byYear = totals.get(week) ?? new Map<number, number>()
      const record: Record<string, number | null> = { epi_week: week }
      for (const year of orderedYears) {
        record[String(year)] = byYear.get(year) ?? null
      }
      return record as InterannualRow
    })
}

// Arma la matriz de casos por geografía y semana para un año
export function buildHeatmap(
  rows: readonly WeeklySeriesRow[],
  year: number,
  level: GeoLevel,
): HeatmapResponse {
  const groups = new Map<string, { geo: string[]; weeks: Map<number, number> }>()
  const weeks = new Set<number>()

  for (const row of rows) {
    if (row.year !== year) {
      continue
    }
    const geo = geoValues(row, level)
    const key = JSON.stringify(geo)
    let group = groups.get(key)
    if (!group) {
      group = { geo, weeks: new Map() }
      groups.set(key, group)
    }
    group.weeks.set(row.epi_week, (group.weeks.get(row.epi_week) ?? 0) + row.cases)
    weeks.add(row.epi_week)
  }

  const orderedGroups = [...groups.values()].sort((left, right) =>
    compareGeoValues(left.geo, right.geo),
  )
  const orderedWeeks = [...weeks].sort((left, right) => left - right)

  return {
    geographies: orderedGroups.map((group) =>
      level === 'department' ? (group.geo[0] ?? '') : pythonTuple(group.geo),
    ),
    weeks: orderedWeeks,
    values: orderedGroups.map((group) => orderedWeeks.map((week) => group.weeks.get(week) ?? 0)),
  }
}

// Redondea a 3 decimales los promedios calculados
function roundValue(value: number): number {
  return Math.round(value * 1000) / 1000
}

// Ordena las geografías por total (o promedio semanal) de casos, opcionalmente filtrando por año
export function buildRanking(
  rows: readonly WeeklySeriesRow[],
  level: GeoLevel,
  year?: number,
  aggregate: Aggregate = 'sum',
): RankingRow[] {
  const totals = new Map<string, { geo: string[]; cases: number; weeks: number }>()
  for (const row of rows) {
    if (year !== undefined && row.year !== year) {
      continue
    }
    const geo = geoValues(row, level)
    const key = JSON.stringify(geo)
    const current = totals.get(key)
    if (current) {
      current.cases += row.cases
      current.weeks += 1
    } else {
      totals.set(key, { geo, cases: row.cases, weeks: 1 })
    }
  }
  if (aggregate === 'mean') {
    for (const entry of totals.values()) {
      entry.cases = roundValue(entry.cases / entry.weeks)
    }
  }

  return [...totals.values()]
    .sort((left, right) => right.cases - left.cases)
    .map((entry, index) => {
      if (level === 'department') {
        return {
          rank: index + 1,
          department: entry.geo[0] ?? '',
          cases: entry.cases,
        }
      }
      return {
        rank: index + 1,
        department: entry.geo[0] ?? '',
        province: entry.geo[1] ?? '',
        cases: entry.cases,
      }
    })
}

// Marca anomalías con z-score robusto sobre residuos de la línea base estacional
export function buildAnomalies(
  rows: readonly WeeklySeriesRow[],
  level: GeoLevel,
  threshold = DEFAULT_ANOMALY_THRESHOLD,
): AnomalyRow[] {
  const baselineSamples = new Map<string, number[]>()
  for (const row of rows) {
    const key = JSON.stringify([...geoValues(row, level), row.epi_week])
    const samples = baselineSamples.get(key)
    if (samples) {
      samples.push(row.cases)
    } else {
      baselineSamples.set(key, [row.cases])
    }
  }

  const baselines = new Map<string, number>()
  for (const [key, samples] of baselineSamples) {
    baselines.set(key, median(samples))
  }

  const residualsByGeo = new Map<string, number[]>()
  const residuals: number[] = []
  for (const row of rows) {
    const baselineKey = JSON.stringify([...geoValues(row, level), row.epi_week])
    const residual = row.cases - (baselines.get(baselineKey) ?? 0)
    residuals.push(residual)
    const geoKey = JSON.stringify(geoValues(row, level))
    const samples = residualsByGeo.get(geoKey)
    if (samples) {
      samples.push(residual)
    } else {
      residualsByGeo.set(geoKey, [residual])
    }
  }

  const centers = new Map<string, number>()
  const mads = new Map<string, number>()
  for (const [key, samples] of residualsByGeo) {
    const center = median(samples)
    centers.set(key, center)
    mads.set(key, median(samples.map((value) => Math.abs(value - center))))
  }

  return rows.map((row, index) => {
    const geo = geoValues(row, level)
    const geoKey = JSON.stringify(geo)
    const center = centers.get(geoKey) ?? 0
    const mad = mads.get(geoKey) ?? 0
    const residual = residuals[index] ?? 0
    const robustZ = mad === 0 ? 0 : (MAD_SCALE * (residual - center)) / mad
    const base = {
      department: geo[0] ?? '',
      year: row.year,
      epi_week: row.epi_week,
      cases: row.cases,
      seasonal_baseline: baselines.get(JSON.stringify([...geo, row.epi_week])) ?? 0,
      residual,
      robust_z: Number(robustZ.toFixed(10)),
      is_anomaly: Math.abs(robustZ) > threshold,
    }
    if (level === 'department') {
      return base
    }
    return { ...base, province: geo[1] ?? '' }
  })
}

// Calcula la mediana como pandas: con tamaño par promedia los dos centrales
export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return Number.NaN
  }
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? Number.NaN
  }
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

// Devuelve el nombre de la geografía de la fila según el nivel
function geographyValue(row: WeeklySeriesRow, level: GeoLevel): string {
  return level === 'department' ? row.department : (row.province ?? '')
}

// Devuelve los valores geográficos de la fila que forman su clave
function geoValues(row: WeeklySeriesRow, level: GeoLevel): string[] {
  return level === 'department' ? [row.department] : [row.department, row.province ?? '']
}

// Compara dos claves geográficas elemento por elemento
function compareGeoValues(left: readonly string[], right: readonly string[]): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const compared = compareText(left[index] ?? '', right[index] ?? '')
    if (compared !== 0) {
      return compared
    }
  }
  return 0
}

// Compara dos textos por orden binario
function compareText(left: string, right: string): number {
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

// Formatea los valores como una tupla de Python, igual que la API heredada
function pythonTuple(values: readonly string[]): string {
  return `(${values.map(pythonString).join(', ')}${values.length === 1 ? ',' : ''})`
}

// Formatea un texto como lo haría repr() de Python
function pythonString(value: string): string {
  if (!value.includes("'") && !value.includes('\\')) {
    return `'${value}'`
  }
  if (!value.includes('"')) {
    return `"${value}"`
  }
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}
