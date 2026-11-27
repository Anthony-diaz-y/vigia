import type { MappingTarget } from './fields'

export const COLUMN_ROLES = [
  'date',
  'year',
  'week',
  'month',
  'place',
  'category',
  'measure',
  'count',
  'identifier',
  'ignore',
] as const

export type ColumnRole = (typeof COLUMN_ROLES)[number]

export const PLACE_LEVELS = ['department', 'province', 'district', 'location', 'ubigeo'] as const

export type PlaceLevel = (typeof PLACE_LEVELS)[number]

export type ColumnKind = 'date' | 'number' | 'text'

export type TimeKind = 'date' | 'week' | 'month' | 'year' | 'none'

export interface DatasetColumn {
  name: string
  label: string
  role: ColumnRole
  level: PlaceLevel | null
  field: DescriptiveField | null
  kind: ColumnKind
  values?: Record<string, string>
}

export const ROLE_INFO: readonly { id: ColumnRole; label: string; description: string }[] = [
  { id: 'date', label: 'Fecha', description: 'Momento del registro; permite ver la evolución.' },
  { id: 'year', label: 'Año', description: 'Año del registro, cuando no hay fecha completa.' },
  { id: 'week', label: 'Semana', description: 'Semana epidemiológica, de 1 a 53.' },
  { id: 'month', label: 'Mes', description: 'Mes del registro, de 1 a 12.' },
  { id: 'place', label: 'Lugar', description: 'Dónde ocurrió: departamento, provincia, distrito…' },
  {
    id: 'category',
    label: 'Categoría',
    description: 'Texto con pocos valores: sexo, diagnóstico…',
  },
  {
    id: 'measure',
    label: 'Valor medido',
    description: 'Número que se promedia: hemoglobina, edad, porcentajes, tasas…',
  },
  {
    id: 'count',
    label: 'Cantidad',
    description: 'Número que se suma: casos, atenciones, personas… Puede haber varias.',
  },
  { id: 'identifier', label: 'Identificador', description: 'Código de registro; no se guarda.' },
  { id: 'ignore', label: 'No usar', description: 'La columna no se usa ni se guarda.' },
]

export const PLACE_LEVEL_INFO: readonly { id: PlaceLevel; label: string }[] = [
  { id: 'department', label: 'Departamento' },
  { id: 'province', label: 'Provincia' },
  { id: 'district', label: 'Distrito' },
  { id: 'location', label: 'Ubicación completa' },
  { id: 'ubigeo', label: 'Código UBIGEO' },
]

export const DESCRIPTIVE_FIELDS = [
  'sex',
  'age_group',
  'age_type',
  'diagnosis',
  'diagnosis_type',
  'directorate',
  'disease',
] as const satisfies readonly MappingTarget[]

const FIELD_ROLES: ReadonlySet<ColumnRole> = new Set(['category', 'measure'])

export type DescriptiveField = (typeof DESCRIPTIVE_FIELDS)[number]

// Indica si un valor es un campo descriptivo de la capa epidemiológica
export function isDescriptiveField(value: unknown): value is DescriptiveField {
  return (DESCRIPTIVE_FIELDS as readonly unknown[]).includes(value)
}

// Deja el campo epidemiológico solo en categorías o valores medidos y solo si es descriptivo
function cleanField(column: DatasetColumn): DescriptiveField | null {
  return FIELD_ROLES.has(column.role) && isDescriptiveField(column.field) ? column.field : null
}

const SINGLE_ROLES: ReadonlySet<ColumnRole> = new Set(['date', 'year', 'week', 'month'])

const EPI_ROLE_FIELD: Partial<Record<ColumnRole, MappingTarget>> = {
  date: 'event_date',
  year: 'year',
  week: 'epi_week',
  count: 'cases',
}

// Indica qué tipo de tiempo tiene el dataset: fecha, año con semana o mes, solo año o ninguno
export function timeSupport(columns: readonly DatasetColumn[]): TimeKind {
  const roles = new Set(columns.map((column) => column.role))
  if (roles.has('date')) {
    return 'date'
  }
  if (roles.has('year') && roles.has('week')) {
    return 'week'
  }
  if (roles.has('year') && roles.has('month')) {
    return 'month'
  }
  return roles.has('year') ? 'year' : 'none'
}

// Corrige los roles: una sola fecha y parte de tiempo, un lugar por nivel y varias cantidades
export function validateColumns(columns: readonly DatasetColumn[]): DatasetColumn[] {
  const taken = new Set<string>()
  const result = columns.map((column) => {
    const level = column.role === 'place' ? (column.level ?? 'department') : null
    const slot = column.role === 'place' ? `place:${level}` : column.role
    const repeated = (SINGLE_ROLES.has(column.role) || column.role === 'place') && taken.has(slot)
    taken.add(slot)
    return repeated
      ? { ...column, role: 'ignore' as const, level: null, field: null }
      : { ...column, level, field: cleanField(column) }
  })
  if (result.every((column) => column.role === 'identifier' || column.role === 'ignore')) {
    throw new Error('ninguna columna útil')
  }
  return result
}

// Deriva el mapeo de la capa epidemiológica (campo → columna) a partir de los roles
export function toEpiMapping(columns: readonly DatasetColumn[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const column of columns) {
    const target =
      column.role === 'place' ? column.level : (EPI_ROLE_FIELD[column.role] ?? cleanField(column))
    if (target && mapping[target] === undefined) {
      mapping[target] = column.name
    }
  }
  return mapping
}
