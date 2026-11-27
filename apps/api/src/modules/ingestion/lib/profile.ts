import { normalizeHeader } from './mapping'
import {
  isDescriptiveField,
  isWholeCount,
  looksLikeCountName,
  parseDate,
  MAX_EPI_WEEK,
  MAX_YEAR,
  MIN_YEAR,
  parseNumber,
  type ColumnKind,
  type ColumnRole,
  type DatasetColumn,
  type DescriptiveField,
  type MappingTarget,
  type PlaceLevel,
} from '@vigia/epidemiology'

export interface ColumnProfile {
  kind: ColumnKind
  distinct: number
  filled: number
  whole: boolean
  min: number | null
  max: number | null
  spaced: boolean
}

export interface RoleSuggestion {
  role: ColumnRole
  level: PlaceLevel | null
  field: DescriptiveField | null
}

const CODE_HEADER = /(^|_)(cod|codigo|code|id|ubigeo|renaes|nro|numero)(_|$)/
const CODE_LABEL = /c[oó]digo|\bid\b|ubigeo|renaes/i
const MAX_CODE_CATEGORIES = 50
const MIN_DATE_RATIO = 0.75
const MIN_NUMBER_RATIO = 0.9
const MIN_ROWS_FOR_IDENTIFIER = 10
const MIN_IDENTIFIER_RATIO = 0.95
const IDENTIFIER_HEADER =
  /^(id|codigo|cod|nro|num|numero)(_registro|_ficha|_caso|_atencion)?$|^(nro|numero|codigo)_registro$/

const TIME_HEADERS: Readonly<Record<string, 'month' | 'week' | 'year'>> = {
  mes: 'month',
  month: 'month',
  semana: 'week',
  sem: 'week',
  se: 'week',
  week: 'week',
  anio: 'year',
  ano: 'year',
  year: 'year',
}
const TIME_RANGES = {
  month: [1, 12],
  week: [1, MAX_EPI_WEEK],
  year: [MIN_YEAR, MAX_YEAR],
} as const
const PLACE_HEADERS: Readonly<Record<string, PlaceLevel>> = {
  dist: 'district',
  distrito: 'district',
  prov: 'province',
  provincia: 'province',
  dep: 'department',
  dpto: 'department',
  depto: 'department',
  departamento: 'department',
  region: 'department',
  ubigeo: 'ubigeo',
}
const NAME_PREFIXES: ReadonlySet<string> = new Set(['nom', 'nombre', 'name'])
const CODE_WORDS: ReadonlySet<string> = new Set(['cod', 'codigo', 'code', 'id', 'nro', 'numero'])

const FIELD_ROLES: Partial<Record<MappingTarget, ColumnRole>> = {
  event_date: 'date',
  year: 'year',
  epi_week: 'week',
  cases: 'count',
  department: 'place',
  province: 'place',
  district: 'place',
  location: 'place',
  ubigeo: 'place',
  age_group: 'measure',
}

// Resume una columna: si es fecha, número o texto, y cuántos valores distintos y llenos tiene
export function profileColumn(values: readonly string[]): ColumnProfile {
  const filled = values.map((value) => value.trim()).filter((value) => value !== '')
  const ratio = (test: (value: string) => boolean) =>
    filled.length === 0 ? 0 : filled.filter(test).length / filled.length
  const kind: ColumnKind =
    ratio((value) => parseDate(value) !== null) >= MIN_DATE_RATIO
      ? 'date'
      : ratio((value) => parseNumber(value) !== null) >= MIN_NUMBER_RATIO
        ? 'number'
        : 'text'
  const numbers = filled.map((value) => parseNumber(value)).filter((n): n is number => n !== null)
  return {
    kind,
    distinct: new Set(filled).size,
    filled: filled.length,
    whole: kind === 'number' && isWholeCount(filled.filter((value) => parseNumber(value) !== null)),
    min: kind === 'number' && numbers.length > 0 ? numbers.reduce((a, b) => Math.min(a, b)) : null,
    max: kind === 'number' && numbers.length > 0 ? numbers.reduce((a, b) => Math.max(a, b)) : null,
    spaced: ratio((value) => /[ \t]/.test(value)) > 0.5,
  }
}

// Deduce el nivel de lugar de un encabezado como nom_dist o provincia; null si no lo es o es un código
function placeLevel(name: string): PlaceLevel | null {
  const words = normalizeHeader(name)
    .split('_')
    .filter((word) => word !== '')
  const rest = words.length > 1 && NAME_PREFIXES.has(words[0] ?? '') ? words.slice(1) : words
  const [word] = rest
  return rest.length === 1 && word !== undefined && !words.some((w) => CODE_WORDS.has(w))
    ? (PLACE_HEADERS[word] ?? null)
    : null
}

// Deduce mes, semana o año de un encabezado y del rango de sus valores enteros
function timeRole(name: string, profile: ColumnProfile): 'month' | 'week' | 'year' | null {
  const role = TIME_HEADERS[normalizeHeader(name)]
  if (!role || !profile.whole || profile.min === null || profile.max === null) {
    return null
  }
  const [low, high] = TIME_RANGES[role]
  return profile.min >= low && profile.max <= high ? role : null
}

// Indica si una columna de texto casi único es texto libre (con espacios) y no un código
export function isFreeText(profile: ColumnProfile): boolean {
  return profile.kind === 'text' && profile.spaced && isNearlyUnique(profile)
}

// Indica si casi todos los valores de una columna con suficientes filas son distintos
function isNearlyUnique(profile: ColumnProfile): boolean {
  return (
    profile.filled >= MIN_ROWS_FOR_IDENTIFIER &&
    profile.distinct / profile.filled >= MIN_IDENTIFIER_RATIO
  )
}

// Indica si una columna es un código (por su encabezado o su descripción) y no una medida
export function isCodeColumn(name: string, label: string): boolean {
  return CODE_HEADER.test(normalizeHeader(name)) || CODE_LABEL.test(label)
}

// Sugiere el rol de una columna por su alias, su encabezado o su perfil
export function ruleSuggestion(
  name: string,
  profile: ColumnProfile,
  aliasTarget: MappingTarget | null,
): RoleSuggestion {
  if (aliasTarget) {
    const role = FIELD_ROLES[aliasTarget] ?? 'category'
    return {
      role,
      level: role === 'place' ? (aliasTarget as PlaceLevel) : null,
      field:
        (role === 'category' || role === 'measure') && isDescriptiveField(aliasTarget)
          ? aliasTarget
          : null,
    }
  }
  const none = { level: null, field: null }
  if (IDENTIFIER_HEADER.test(normalizeHeader(name))) {
    return { role: 'identifier', ...none }
  }
  const level = profile.kind === 'text' && profile.filled > 0 ? placeLevel(name) : null
  if (level) {
    return { role: 'place', level, field: null }
  }
  if (profile.distinct <= 1) {
    return { role: 'ignore', ...none }
  }
  if (profile.kind === 'date') {
    return { role: 'date', ...none }
  }
  const time = timeRole(name, profile)
  if (time) {
    return { role: time, ...none }
  }
  if (profile.whole && looksLikeCountName(name) && !isCodeColumn(name, '')) {
    return { role: 'count', ...none }
  }
  if (isFreeText(profile)) {
    return { role: 'ignore', ...none }
  }
  if (isNearlyUnique(profile) && (profile.kind !== 'number' || profile.whole)) {
    return { role: 'identifier', ...none }
  }
  return { role: profile.kind === 'number' ? 'measure' : 'category', ...none }
}

// Corrige sugerencias: un código nunca es valor medido; con pocos valores es categoría, si no identificador
export function demoteCodes(
  columns: readonly DatasetColumn[],
  distinct: ReadonlyMap<string, number>,
) {
  return columns.map((column) =>
    column.role === 'measure' && isCodeColumn(column.name, column.label)
      ? {
          ...column,
          role:
            (distinct.get(column.name) ?? 0) <= MAX_CODE_CATEGORIES
              ? ('category' as const)
              : ('identifier' as const),
          field: null,
        }
      : column,
  )
}
