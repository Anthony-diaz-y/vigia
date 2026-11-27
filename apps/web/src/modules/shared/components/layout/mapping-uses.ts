import type { DatasetColumnDto } from '@vigia/contracts'

import type { SelectOption } from '../ui'

export type Role = DatasetColumnDto['role']
export type Level = NonNullable<DatasetColumnDto['level']>
export type Use = Exclude<Role, 'place' | 'identifier'> | `place:${Level}`

export const SINGLE_ROLES: ReadonlySet<Role> = new Set(['date', 'year', 'week', 'month'])
const UNUSED_ROLES: ReadonlySet<Role> = new Set(['identifier', 'ignore'])
const TIME_ROLES: ReadonlySet<Role> = new Set(['date', 'year', 'week', 'month'])

const ROLE_NAMES: Readonly<Record<Exclude<Role, 'place' | 'identifier'>, string>> = {
  date: 'Fecha',
  year: 'Año',
  week: 'Semana',
  month: 'Mes',
  measure: 'Indicador para medir',
  count: 'Cantidad de casos',
  category: 'Agrupar por',
  ignore: 'No usar',
}

const ROLE_HINTS: Readonly<Record<Exclude<Role, 'place' | 'identifier'>, string>> = {
  date: 'Día exacto del registro. Permite ver la evolución.',
  year: 'Año del registro, cuando no hay fecha completa.',
  week: 'Semana epidemiológica, de 1 a 53.',
  month: 'Mes del registro, de 1 a 12.',
  measure: 'Número que se promedia, como la hemoglobina, la edad o un porcentaje.',
  count: 'Número que se suma: casos, atenciones, personas. Puede haber varias.',
  category: 'Texto con pocos valores para separar resultados: sexo, diagnóstico…',
  ignore: 'No aparece en el tablero ni se guarda.',
}

const LEVEL_NAMES: Readonly<Record<Level, string>> = {
  department: 'Departamento',
  province: 'Provincia',
  district: 'Distrito',
  location: 'Ubicación completa',
  ubigeo: 'Código UBIGEO',
}

const LEVEL_HINTS: Readonly<Record<Level, string>> = {
  department: 'Ejemplo: Lima, Cusco.',
  province: 'Ejemplo: Lima, Callao.',
  district: 'Ejemplo: Ate, Ancón.',
  location: 'Texto con la ubicación completa.',
  ubigeo: 'Código numérico del lugar, ejemplo: 150101.',
}

const USE_ORDER: readonly Use[] = [
  'date',
  'year',
  'week',
  'month',
  'place:department',
  'place:province',
  'place:district',
  'place:location',
  'place:ubigeo',
  'measure',
  'count',
  'category',
  'ignore',
]

// Indica si el rol deja la columna fuera del tablero (el identificador también cuenta como no usar)
export function isUnusedRole(role: Role): boolean {
  return UNUSED_ROLES.has(role)
}

// Indica si el rol es de tiempo
export function isTimeRole(role: Role): boolean {
  return TIME_ROLES.has(role)
}

// Convierte el rol y el nivel de una columna en el uso que se le muestra al usuario
export function useOf(column: Pick<DatasetColumnDto, 'role' | 'level'>): Use {
  if (column.role === 'place') {
    return `place:${column.level ?? 'department'}`
  }
  return column.role === 'identifier' ? 'ignore' : column.role
}

// Separa un uso elegido en el rol y el nivel de lugar que se guardan
export function parseUse(use: Use): { role: Role; level: Level | null } {
  return use.startsWith('place:')
    ? { role: 'place', level: use.slice('place:'.length) as Level }
    : { role: use as Role, level: null }
}

// Nombre corto del uso de una columna, para etiquetas y avisos
export function shortUseName(use: Use): string {
  return use.startsWith('place:') ? LEVEL_NAMES[use.slice('place:'.length) as Level] : nameOf(use)
}

// Nombre completo del uso: agrega el grupo (Tiempo o Lugar) cuando ayuda a entenderlo
export function fullUseName(use: Use): string {
  if (use.startsWith('place:')) {
    return `Lugar · ${shortUseName(use)}`
  }
  return ['date', 'year', 'week', 'month'].includes(use) ? `Tiempo · ${nameOf(use)}` : nameOf(use)
}

// Nombre de un uso que no es de lugar
function nameOf(use: Use): string {
  return ROLE_NAMES[use as keyof typeof ROLE_NAMES]
}

// Opciones de uso para una columna; avisa qué otra columna deja de usarse si el uso es único
export function useOptions(
  columns: readonly DatasetColumnDto[],
  name: string,
): SelectOption<Use>[] {
  return USE_ORDER.map((use) => {
    const { role } = parseUse(use)
    const taken = columns.find(
      (column) =>
        column.name !== name &&
        useOf(column) === use &&
        (SINGLE_ROLES.has(role) || role === 'place'),
    )
    const base = use.startsWith('place:')
      ? LEVEL_HINTS[use.slice('place:'.length) as Level]
      : ROLE_HINTS[use as keyof typeof ROLE_HINTS]
    const note = taken
      ? ` Reemplaza a «${taken.label.trim() || taken.name}», que pasará a No usar.`
      : ''
    return { value: use, label: fullUseName(use), hint: `${base}${note}` }
  })
}
