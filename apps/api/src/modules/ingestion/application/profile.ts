import { normalizeHeader } from '../infrastructure/mapping'
import {
  isDescriptiveField,
  parseDate,
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
  return { kind, distinct: new Set(filled).size, filled: filled.length }
}

// Indica si una columna es un código (por su encabezado o su descripción) y no una medida
export function isCodeColumn(name: string, label: string): boolean {
  return CODE_HEADER.test(normalizeHeader(name)) || CODE_LABEL.test(label)
}

// Sugiere el rol de una columna por su alias, por un encabezado de código o por su perfil
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
  if (profile.distinct <= 1) {
    return { role: 'ignore', ...none }
  }
  if (profile.kind === 'date') {
    return { role: 'date', ...none }
  }
  const unique =
    profile.filled >= MIN_ROWS_FOR_IDENTIFIER &&
    profile.distinct / profile.filled >= MIN_IDENTIFIER_RATIO
  if (unique) {
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
