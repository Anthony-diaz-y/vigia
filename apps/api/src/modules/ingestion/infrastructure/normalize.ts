import {
  AGE_BANDS,
  KEY_COLUMNS,
  MAX_EPI_WEEK,
  MAX_YEAR,
  MIN_EPI_WEEK,
  MIN_YEAR,
  SEX_VALUES,
  UBIGEO_LENGTH,
  UNKNOWN,
  epiWeekOf,
  parseDate,
  splitLocation,
} from '@vigia/epidemiology'

import { IssueCollector, type QualityIssue } from '../domain/quality'
import type { MappingResult, SourceConfig } from './mapping'

export interface CanonicalRow {
  disease: string
  ubigeo: string
  year: number
  epi_week: number
  department: string
  province: string
  district: string
  directorate: string
  sex: string
  age_group: string
  age_type: string
  diagnosis: string
  diagnosis_type: string
  cases: number
}

export interface NormalizedTable {
  rows: CanonicalRow[]
  rowsDropped: number
  duplicatesCollapsed: number
  issues: QualityIssue[]
}

interface InternalRow extends Omit<CanonicalRow, 'year' | 'epi_week' | 'cases'> {
  year: number | null
  epi_week: number | null
  cases: number | null
}

interface UbigeoResult {
  values: string[]
  missing: boolean[]
  invalid: boolean[]
}

interface BoundedIntResult {
  values: (number | null)[]
  unparseable: boolean[]
  outOfRange: boolean[]
}

interface TimeResult {
  year: BoundedIntResult
  week: BoundedIntResult
  invalidDate: boolean[]
  source: string
}

interface PlaceResult {
  department: string[]
  province: string[]
  district: string[]
  missing: boolean[]
}

interface CasesResult {
  values: (number | null)[]
  missing: boolean[]
  invalid: boolean[]
  negative: boolean[]
}

const NUMERIC_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

// Convierte las filas crudas al contrato canónico, registra problemas y deduplica
export function normalize(
  raw: Record<string, string>[],
  mapping: MappingResult,
  config: SourceConfig,
): NormalizedTable {
  const issues = new IssueCollector()
  const count = raw.length

  const ubigeo = ubigeoValues(columnValues(raw, mapping, 'ubigeo'), count)
  const time = timeValues(raw, mapping, count)
  const { year, week } = time
  const place = placeValues(raw, mapping, count)
  const cases = casesValues(columnValues(raw, mapping, 'cases'), count)

  issues.addMany(
    'missing_ubigeo',
    'Row has no UBIGEO.',
    rawSamples(raw, mapping, 'ubigeo', ubigeo.missing),
  )
  issues.addMany(
    'invalid_ubigeo',
    'UBIGEO is not a 6-digit code.',
    rawSamples(raw, mapping, 'ubigeo', ubigeo.invalid),
  )
  issues.addMany(
    'invalid_year',
    'Year could not be read as a number.',
    rawSamples(raw, mapping, 'year', year.unparseable),
  )
  issues.addMany(
    'invalid_event_date',
    'Event date could not be read as a day/month/year date.',
    rawSamples(raw, mapping, 'event_date', time.invalidDate),
  )
  issues.addMany(
    'year_out_of_range',
    `Year is outside ${MIN_YEAR}-${MAX_YEAR}.`,
    rawSamples(raw, mapping, time.source, year.outOfRange),
  )
  issues.addMany(
    'invalid_epi_week',
    'Epidemiological week could not be read as a number.',
    rawSamples(raw, mapping, 'epi_week', week.unparseable),
  )
  issues.addMany(
    'epi_week_out_of_range',
    `Epidemiological week is outside ${MIN_EPI_WEEK}-${MAX_EPI_WEEK}.`,
    rawSamples(raw, mapping, 'epi_week', week.outOfRange),
  )
  issues.addMany(
    'missing_cases',
    'Row has no case count.',
    rawSamples(raw, mapping, 'cases', cases.missing),
  )
  issues.addMany(
    'invalid_cases',
    'Case count is not a number.',
    rawSamples(raw, mapping, 'cases', cases.invalid),
  )
  issues.addMany(
    'negative_cases',
    'Case count is negative.',
    rawSamples(raw, mapping, 'cases', cases.negative),
  )
  issues.addMany(
    'missing_location',
    'Row has no UBIGEO or department.',
    rawSamples(raw, mapping, mapping.mapping.location ? 'location' : 'department', place.missing),
  )

  const assembled = assemble(raw, mapping, config, ubigeo, place, year, week, cases, issues)

  const valid = assembled.filter((_, index) => {
    return !(
      ubigeo.missing[index] ||
      ubigeo.invalid[index] ||
      year.unparseable[index] ||
      year.outOfRange[index] ||
      time.invalidDate[index] ||
      place.missing[index] ||
      week.unparseable[index] ||
      week.outOfRange[index] ||
      cases.missing[index] ||
      cases.invalid[index] ||
      cases.negative[index]
    )
  })
  const rowsDropped = count - valid.length
  const { rows, duplicatesCollapsed } = deduplicate(valid)

  return {
    rows,
    rowsDropped,
    duplicatesCollapsed,
    issues: issues.build(),
  }
}

// Devuelve los valores crudos de la columna mapeada a un campo canónico, o null si no existe
function columnValues(
  raw: Record<string, string>[],
  mapping: MappingResult,
  canonical: string,
): string[] | null {
  const source = mapping.mapping[canonical]
  if (source === undefined) {
    return null
  }
  return raw.map((row) => row[source] ?? '')
}

// Recorta los valores de texto o devuelve vacíos si la columna no existe
function textValues(values: string[] | null, count: number): string[] {
  if (values === null) {
    return Array.from({ length: count }, () => '')
  }
  return values.map((value) => value.trim())
}

// Interpreta un texto como número finito o devuelve null
function numeric(text: string): number | null {
  const cleaned = text.replace(/\.0+$/, '')
  if (cleaned === '' || !NUMERIC_PATTERN.test(cleaned)) {
    return null
  }
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

// Normaliza los UBIGEO a 6 dígitos y marca faltantes o inválidos; sin columna, queda vacío
function ubigeoValues(values: string[] | null, count: number): UbigeoResult {
  if (values === null) {
    return {
      values: Array.from({ length: count }, () => ''),
      missing: Array.from({ length: count }, () => false),
      invalid: Array.from({ length: count }, () => false),
    }
  }
  const texts = textValues(values, count)
  const result: UbigeoResult = { values: [], missing: [], invalid: [] }
  for (const text of texts) {
    const normalized = text.replace(/\.0+$/, '')
    const missing = normalized === ''
    const usable = /^\d+$/.test(normalized) && normalized.length <= UBIGEO_LENGTH
    result.missing.push(missing)
    result.invalid.push(!missing && !usable)
    result.values.push(usable ? normalized.padStart(UBIGEO_LENGTH, '0') : '')
  }
  return result
}

// Convierte a enteros y marca los ilegibles o fuera del rango permitido
function boundedIntValues(
  values: string[] | null,
  count: number,
  low: number,
  high: number,
): BoundedIntResult {
  const texts = textValues(values, count)
  const result: BoundedIntResult = { values: [], unparseable: [], outOfRange: [] }
  for (const text of texts) {
    const number = numeric(text)
    const whole = number !== null && number % 1 === 0 ? number : null
    result.values.push(whole)
    result.unparseable.push(whole === null)
    result.outOfRange.push(whole !== null && (whole < low || whole > high))
  }
  return result
}

// Obtiene año y semana de sus columnas o, si faltan, los calcula desde la fecha del caso
function timeValues(
  raw: Record<string, string>[],
  mapping: MappingResult,
  count: number,
): TimeResult {
  const explicit = mapping.mapping.year !== undefined && mapping.mapping.epi_week !== undefined
  const dates = explicit ? null : columnValues(raw, mapping, 'event_date')
  if (dates === null) {
    return {
      year: boundedIntValues(columnValues(raw, mapping, 'year'), count, MIN_YEAR, MAX_YEAR),
      week: boundedIntValues(
        columnValues(raw, mapping, 'epi_week'),
        count,
        MIN_EPI_WEEK,
        MAX_EPI_WEEK,
      ),
      invalidDate: Array.from({ length: count }, () => false),
      source: 'year',
    }
  }

  const year: BoundedIntResult = { values: [], unparseable: [], outOfRange: [] }
  const week: BoundedIntResult = { values: [], unparseable: [], outOfRange: [] }
  const invalidDate: boolean[] = []
  for (const text of dates) {
    const date = parseDate(text)
    const parts = date ? epiWeekOf(date) : null
    invalidDate.push(parts === null)
    year.values.push(parts?.year ?? null)
    year.unparseable.push(false)
    year.outOfRange.push(parts !== null && (parts.year < MIN_YEAR || parts.year > MAX_YEAR))
    week.values.push(parts?.epi_week ?? null)
    week.unparseable.push(false)
    week.outOfRange.push(false)
  }
  return { year, week, invalidDate, source: 'event_date' }
}

// Arma departamento, provincia y distrito desde sus columnas o desde la ubicación combinada
function placeValues(
  raw: Record<string, string>[],
  mapping: MappingResult,
  count: number,
): PlaceResult {
  const upper = (canonical: string) =>
    textValues(columnValues(raw, mapping, canonical), count).map((value) => value.toUpperCase())
  const department = upper('department')
  const province = upper('province')
  const district = upper('district')

  const locations = columnValues(raw, mapping, 'location')
  if (locations !== null) {
    locations.forEach((text, index) => {
      const parts = splitLocation(text)
      department[index] = department[index] || parts.department
      province[index] = province[index] || parts.province
      district[index] = district[index] || parts.district
    })
  }

  const ubigeoMapped = mapping.mapping.ubigeo !== undefined
  return {
    department,
    province,
    district,
    missing: department.map((value) => !ubigeoMapped && value === ''),
  }
}

// Lee el conteo de casos (o 1 por fila) y marca faltantes, inválidos y negativos
function casesValues(values: string[] | null, count: number): CasesResult {
  if (values === null) {
    return {
      values: Array.from({ length: count }, () => 1),
      missing: Array.from({ length: count }, () => false),
      invalid: Array.from({ length: count }, () => false),
      negative: Array.from({ length: count }, () => false),
    }
  }
  const texts = textValues(values, count)
  const result: CasesResult = { values: [], missing: [], invalid: [], negative: [] }
  for (const text of texts) {
    const number = numeric(text)
    const missing = text === ''
    result.values.push(number)
    result.missing.push(missing)
    result.invalid.push(!missing && number === null)
    result.negative.push(number !== null && number < 0)
  }
  return result
}

// Extrae los valores crudos de las filas marcadas en la máscara como muestras
function rawSamples(
  raw: Record<string, string>[],
  mapping: MappingResult,
  canonical: string,
  mask: boolean[],
): string[] {
  const values = columnValues(raw, mapping, canonical)
  if (values === null) {
    return []
  }
  const samples: string[] = []
  for (let index = 0; index < values.length; index += 1) {
    if (mask[index]) {
      samples.push((values[index] ?? '').trim())
    }
  }
  return samples
}

// Arma las filas internas con texto normalizado, sexo, grupo de edad y enfermedad
function assemble(
  raw: Record<string, string>[],
  mapping: MappingResult,
  config: SourceConfig,
  ubigeo: UbigeoResult,
  place: PlaceResult,
  year: BoundedIntResult,
  week: BoundedIntResult,
  cases: CasesResult,
  issues: IssueCollector,
): InternalRow[] {
  const count = raw.length
  const upper = (values: string[] | null): string[] =>
    textValues(values, count).map((value) => value.toUpperCase())

  const { department, province, district } = place
  const directorate = upper(columnValues(raw, mapping, 'directorate'))
  const diagnosis = upper(columnValues(raw, mapping, 'diagnosis'))
  const diagnosisType = upper(columnValues(raw, mapping, 'diagnosis_type'))
  const ageType = upper(columnValues(raw, mapping, 'age_type'))
  const ageValues = textValues(columnValues(raw, mapping, 'age_group'), count)
  const sexValues = upper(columnValues(raw, mapping, 'sex'))

  const diseaseSource = columnValues(raw, mapping, 'disease')
  const diseaseText = textValues(diseaseSource, count)
  const diseaseMismatch: string[] = []
  const disease = diseaseText.map((value) => {
    const normalized = value.toUpperCase()
    if (normalized !== '' && normalized !== config.disease) {
      diseaseMismatch.push(value)
      return config.disease
    }
    return normalized || config.disease
  })
  issues.addMany(
    'disease_mismatch',
    `Row declares a disease other than ${config.disease}.`,
    diseaseMismatch,
  )

  return raw.map((_, index) => {
    const ageGroup = ageGroupValue(ageValues[index] ?? '', ageType[index] ?? '')
    return {
      disease: disease[index] ?? config.disease,
      ubigeo: ubigeo.values[index] ?? '',
      year: year.values[index] ?? null,
      epi_week: week.values[index] ?? null,
      department: department[index] ?? '',
      province: province[index] ?? '',
      district: district[index] ?? '',
      directorate: directorate[index] ?? '',
      sex: SEX_VALUES[sexValues[index] ?? ''] ?? UNKNOWN,
      age_group: ageGroup,
      age_type: ageType[index] ?? '',
      diagnosis: diagnosis[index] ?? '',
      diagnosis_type: diagnosisType[index] ?? '',
      cases: cases.values[index] ?? null,
    }
  })
}

// Asigna la banda de edad según la edad y su unidad (meses, días u horas cuentan como <1)
function ageGroupValue(age: string, ageType: string): string {
  const years = numeric(age)
  let band = UNKNOWN
  if (years !== null) {
    for (const [low, high, label] of AGE_BANDS) {
      if (years >= low && years <= high) {
        band = label
        break
      }
    }
  }
  if (/MES|DIA|HORA/.test(ageType) || years === 0) {
    return '<1'
  }
  return band
}

// Agrupa filas por clave sumando casos y cuenta cuántos duplicados se colapsaron
function deduplicate(rows: InternalRow[]): {
  rows: CanonicalRow[]
  duplicatesCollapsed: number
} {
  const grouped = new Map<string, CanonicalRow>()
  for (const row of rows) {
    if (row.year === null || row.epi_week === null || row.cases === null) {
      continue
    }
    const canonical: CanonicalRow = {
      disease: row.disease,
      ubigeo: row.ubigeo,
      year: row.year,
      epi_week: row.epi_week,
      department: row.department,
      province: row.province,
      district: row.district,
      directorate: row.directorate,
      sex: row.sex,
      age_group: row.age_group,
      age_type: row.age_type,
      diagnosis: row.diagnosis,
      diagnosis_type: row.diagnosis_type,
      cases: row.cases,
    }
    const key = JSON.stringify(KEY_COLUMNS.map((column) => canonical[column]))
    const existing = grouped.get(key)
    if (existing) {
      existing.cases += canonical.cases
    } else {
      grouped.set(key, canonical)
    }
  }

  const result = [...grouped.values()].map((row) => ({
    ...row,
    cases: Math.trunc(row.cases),
  }))
  return { rows: result, duplicatesCollapsed: rows.length - result.length }
}
