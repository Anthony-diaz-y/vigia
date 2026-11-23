export const CANONICAL_COLUMNS = [
  'disease',
  'ubigeo',
  'year',
  'epi_week',
  'department',
  'province',
  'district',
  'directorate',
  'sex',
  'age_group',
  'age_type',
  'diagnosis',
  'diagnosis_type',
  'cases',
] as const

export type CanonicalColumn = (typeof CANONICAL_COLUMNS)[number]

export const KEY_COLUMNS = CANONICAL_COLUMNS.filter(
  (column) => column !== 'cases',
) as readonly Exclude<CanonicalColumn, 'cases'>[]

export type KeyColumn = (typeof KEY_COLUMNS)[number]

export const OPTIONAL_COLUMNS: ReadonlySet<CanonicalColumn> = new Set([
  'department',
  'province',
  'district',
  'directorate',
  'sex',
  'age_group',
  'age_type',
  'diagnosis',
  'diagnosis_type',
])

export const MIN_YEAR = 2000

export const MAX_YEAR = new Date().getUTCFullYear() + 1

export const MIN_EPI_WEEK = 1
export const MAX_EPI_WEEK = 53
export const WEEKS_PER_YEAR = 52

export const UBIGEO_LENGTH = 6
export const UNKNOWN = 'unknown'

export const AGE_BANDS = [
  [0, 0, '<1'],
  [1, 4, '1-4'],
  [5, 9, '5-9'],
  [10, 19, '10-19'],
  [20, 29, '20-29'],
  [30, 59, '30-59'],
  [60, 200, '60+'],
] as const satisfies readonly (readonly [number, number, string])[]

export type AgeBand = (typeof AGE_BANDS)[number]

export const SEX_VALUES: Readonly<Record<string, 'F' | 'M'>> = {
  F: 'F',
  FEMENINO: 'F',
  MUJER: 'F',
  M: 'M',
  MASCULINO: 'M',
  HOMBRE: 'M',
}

export const QUALITY_ISSUE_CODES = [
  'missing_ubigeo',
  'invalid_ubigeo',
  'invalid_year',
  'year_out_of_range',
  'invalid_epi_week',
  'epi_week_out_of_range',
  'missing_cases',
  'invalid_cases',
  'negative_cases',
  'disease_mismatch',
  'invalid_event_date',
  'missing_location',
] as const

export type QualityIssueCode = (typeof QUALITY_ISSUE_CODES)[number]

export const UPLOAD_STATUSES = ['ok', 'ok_with_issues'] as const

export type UploadStatus = (typeof UPLOAD_STATUSES)[number]

export const FORECAST_STATUSES = ['publish', 'insufficient_evidence'] as const

export type ForecastStatus = (typeof FORECAST_STATUSES)[number]

// Avanza una semana epidemiológica `steps` semanas usando años de 52 semanas
export function advanceEpiWeek(year: number, epiWeek: number, steps: number): [number, number] {
  const total = year * WEEKS_PER_YEAR + (epiWeek - 1) + steps
  return [Math.floor(total / WEEKS_PER_YEAR), (total % WEEKS_PER_YEAR) + 1]
}
