import { normalizeHeader } from './mapping'
import {
  detectUbigeoLevel,
  isDescriptiveField,
  isWholeCount,
  looksLikeCountName,
  MAX_CODED_VALUES,
  parseDate,
  MAX_EPI_WEEK,
  MAX_YEAR,
  MIN_YEAR,
  parseNumber,
  ubigeoHeaderLevel,
  valueRules,
  type ColumnKind,
  type ColumnRole,
  type DatasetColumn,
  type DescriptiveField,
  type MappingTarget,
  type PlaceLevel,
  type UbigeoLevel,
} from '@vigia/epidemiology'

export interface ColumnProfile {
  kind: ColumnKind
  distinct: number
  filled: number
  whole: boolean
  min: number | null
  max: number | null
  spaced: boolean
  // Valores distintos sin los "Sin dato" y el mayor entre ellos (solo números)
  present?: number
  presentMax?: number | null
}

export interface RoleSuggestion {
  role: ColumnRole
  level: PlaceLevel | null
  field: DescriptiveField | null
}

const CODE_HEADER = /(^|_)(cod|codigo|code|id|ubigeo|renaes|nro|numero)(_|$)/
const CODE_LABEL = /c[oó]digo|\bid\b|ubigeo|renaes/i
const MAX_CODE_CATEGORIES = 50
const DIGITS = /^\d+(?:\.0+)?$/
const MIN_DATE_RATIO = 0.75
const MIN_NUMBER_RATIO = 0.9
const MAX_SMALL_CODE = 99
const MEASURE_HEADER =
  /(^|_)(pct|porc\w*|prom\w*|media|edad\w*|tasa|hb|hemoglobina|peso|talla|indice|ratio|dias|altura|presion)(_|$)/
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
  const missing = valueRules('', filled).missing
  const present = [...new Set(filled)].filter((value) => !missing.has(value))
  const presentNumbers = present
    .map((value) => parseNumber(value))
    .filter((n): n is number => n !== null)
  return {
    kind,
    distinct: new Set(filled).size,
    present: present.length,
    presentMax:
      kind === 'number' && presentNumbers.length > 0
        ? presentNumbers.reduce((a, b) => Math.max(a, b))
        : null,
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

// Indica si un entero con pocos valores distintos y chicos es un código (estado 1/2, nivel 1..3) y no una medida
function isSmallCode(name: string, profile: ColumnProfile): boolean {
  const present = profile.present ?? profile.distinct
  return (
    profile.kind === 'number' &&
    profile.whole &&
    present >= 1 &&
    present <= MAX_CODED_VALUES &&
    profile.min !== null &&
    profile.min >= 0 &&
    (profile.presentMax ?? profile.max ?? 0) <= MAX_SMALL_CODE &&
    !looksLikeCountName(name) &&
    !MEASURE_HEADER.test(normalizeHeader(name))
  )
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

// Nivel de lugar de una columna de códigos UBIGEO, por su encabezado o por sus valores; null si no lo es
export function placeCodeLevel(name: string, values: readonly string[]): UbigeoLevel | null {
  const profile = profileColumn(values)
  const filled = values.map((value) => value.trim()).filter((value) => value !== '')
  const digits = filled.filter((value) => DIGITS.test(value)).length
  if (profile.kind === 'date' || filled.length === 0 || digits / filled.length < MIN_NUMBER_RATIO) {
    return null
  }
  const header = ubigeoHeaderLevel(name)
  if (header) {
    return header
  }
  if (isCodeColumn(name, '')) {
    return null
  }
  const detected = detectUbigeoLevel(filled)
  const notPlace = TIME_HEADERS[normalizeHeader(name)] !== undefined || looksLikeCountName(name)
  return detected === 'department' || notPlace ? null : detected
}

// Sugiere el rol de una columna por su alias, su encabezado, su perfil o su nivel de código
export function ruleSuggestion(
  name: string,
  profile: ColumnProfile,
  aliasTarget: MappingTarget | null,
  codeLevel: UbigeoLevel | null = null,
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
  if (codeLevel) {
    return { role: 'place', level: codeLevel, field: null }
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
  if (isSmallCode(name, profile)) {
    return { role: 'category', ...none }
  }
  return { role: profile.kind === 'number' ? 'measure' : 'category', ...none }
}

// Palabras de un encabezado sin el prefijo de código (cod_red → red) o de nombre (nombre_red → red)
function baseWords(name: string): { base: string; named: boolean; coded: boolean } {
  const words = normalizeHeader(name)
    .split('_')
    .filter((word) => word !== '')
  const first = words[0] ?? ''
  const named = words.length > 1 && NAME_PREFIXES.has(first)
  const coded = words.length > 1 && CODE_WORDS.has(first)
  return { base: (named || coded ? words.slice(1) : words).join('_'), named, coded }
}

// Columnas que son el código de otra con los nombres (red y nombre_red, codigo_x y x): motivo para no graficarlas
export function codeCategoryReasons(columns: readonly DatasetColumn[]): Map<string, string> {
  const categories = columns.filter((column) => column.role === 'category')
  const reasons = new Map<string, string>()
  for (const column of columns) {
    const mine = baseWords(column.name)
    if (mine.named || (column.role !== 'category' && column.role !== 'measure')) {
      continue
    }
    const matches = categories.filter((other) => {
      const info = baseWords(other.name)
      return (
        other.name !== column.name &&
        info.base === mine.base &&
        (info.named || (mine.coded && !info.coded))
      )
    })
    const owner = matches.find((other) => baseWords(other.name).named) ?? matches[0]
    if (owner) {
      reasons.set(
        column.name,
        `Se usa la columna «${owner.label.trim() || owner.name}» con los nombres; este es su código.`,
      )
    }
  }
  return reasons
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
