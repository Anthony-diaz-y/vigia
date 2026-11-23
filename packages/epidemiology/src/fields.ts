import { CANONICAL_COLUMNS } from './contract'

export const DERIVED_COLUMNS = ['event_date', 'location'] as const

export type DerivedColumn = (typeof DERIVED_COLUMNS)[number]

export const MAPPING_TARGETS = [...CANONICAL_COLUMNS, ...DERIVED_COLUMNS] as const

export type MappingTarget = (typeof MAPPING_TARGETS)[number]

export interface MappingTargetInfo {
  id: MappingTarget
  label: string
  description: string
}

export interface RequirementGroup {
  id: string
  label: string
  options: readonly (readonly MappingTarget[])[]
}

export const MAPPING_TARGET_INFO: readonly MappingTargetInfo[] = [
  {
    id: 'event_date',
    label: 'Fecha del caso',
    description:
      'Fecha de inicio de síntomas, notificación o ingreso; se convierte en año y semana epidemiológica.',
  },
  { id: 'year', label: 'Año', description: 'Año epidemiológico del caso.' },
  { id: 'epi_week', label: 'Semana epidemiológica', description: 'Número de semana, de 1 a 53.' },
  {
    id: 'location',
    label: 'Ubicación completa',
    description: 'Departamento, provincia y distrito en una sola columna, separados por guiones.',
  },
  { id: 'department', label: 'Departamento', description: 'Departamento o región del caso.' },
  { id: 'province', label: 'Provincia', description: 'Provincia del caso.' },
  { id: 'district', label: 'Distrito', description: 'Distrito del caso.' },
  { id: 'ubigeo', label: 'Código UBIGEO', description: 'Código INEI de 6 dígitos del distrito.' },
  { id: 'directorate', label: 'DIRESA o red', description: 'Dirección regional o red de salud.' },
  { id: 'sex', label: 'Sexo', description: 'Sexo de la persona.' },
  { id: 'age_group', label: 'Edad', description: 'Edad en número o grupo de edad.' },
  { id: 'age_type', label: 'Unidad de la edad', description: 'Años, meses, días u horas.' },
  {
    id: 'disease',
    label: 'Enfermedad',
    description: 'Evento vigilado; si falta, se asume la enfermedad de la fuente.',
  },
  { id: 'diagnosis', label: 'Diagnóstico', description: 'Diagnóstico registrado del caso.' },
  {
    id: 'diagnosis_type',
    label: 'Tipo de diagnóstico',
    description: 'Confirmado, probable o sospechoso.',
  },
  {
    id: 'cases',
    label: 'Cantidad de casos',
    description: 'Casos que representa la fila; si falta, cada fila cuenta como un caso.',
  },
]

export const REQUIREMENT_GROUPS: readonly RequirementGroup[] = [
  { id: 'time', label: 'Cuándo ocurrió', options: [['event_date'], ['year', 'epi_week']] },
  { id: 'place', label: 'Dónde ocurrió', options: [['location'], ['department'], ['ubigeo']] },
]

const DAY_MS = 24 * 60 * 60 * 1000

const LOCATION_SEPARATORS = ['-', '/', ','] as const

const DEPARTMENT_PREFIXES = [
  /^PROVINCIA CONSTITUCIONAL DEL\s+/,
  /^PROVINCIAS? DE\s+/,
  /^DEPARTAMENTO DE\s+/,
  /^REGION\s+/,
  /^DEL\s+/,
  /^DE\s+/,
]

// Indica si un texto es un destino de mapeo conocido
export function isMappingTarget(value: string): value is MappingTarget {
  return (MAPPING_TARGETS as readonly string[]).includes(value)
}

// Devuelve los grupos obligatorios que ninguna combinación de columnas mapeadas cubre
export function missingRequirements(mapped: Iterable<string>): RequirementGroup[] {
  const available = new Set(mapped)
  return REQUIREMENT_GROUPS.filter(
    (group) => !group.options.some((option) => option.every((target) => available.has(target))),
  )
}

// Lee una fecha día-mes-año, año-mes-día (también ISO con hora) o compacta AAAAMMDD, en UTC
export function parseDate(text: string): Date | null {
  const value = text.trim()
  const isoLike = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/.exec(value)
  const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s.*)?$/.exec(value)
  const compact = /^((?:19|20)\d{2})(\d{2})(\d{2})$/.exec(value)
  const parts = isoLike
    ? [isoLike[1], isoLike[2], isoLike[3]]
    : dayFirst
      ? [dayFirst[3], dayFirst[2], dayFirst[1]]
      : compact
        ? [compact[1], compact[2], compact[3]]
        : null
  if (!parts) {
    return null
  }
  const [year, month, day] = parts.map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return valid ? date : null
}

// Lee un número con punto o coma decimal; devuelve null si el texto no es un número
export function parseNumber(text: string): number | null {
  const value = text.trim().replace(',', '.')
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
    return null
  }
  return Number(value)
}

// Primer domingo de la semana epidemiológica 1 del año (la que tiene al menos 4 días de enero)
function epiYearStart(year: number): number {
  const januaryFirst = Date.UTC(year, 0, 1)
  const weekday = new Date(januaryFirst).getUTCDay()
  return januaryFirst + (weekday <= 3 ? -weekday : 7 - weekday) * DAY_MS
}

// Convierte una fecha en año y semana epidemiológica (semanas de domingo a sábado)
export function epiWeekOf(date: Date): { year: number; epi_week: number } {
  const time = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  let year = date.getUTCFullYear()
  if (time < epiYearStart(year)) {
    year -= 1
  } else if (time >= epiYearStart(year + 1)) {
    year += 1
  }
  return { year, epi_week: Math.floor((time - epiYearStart(year)) / (7 * DAY_MS)) + 1 }
}

// Unifica el nombre de un departamento: sin tildes y sin prefijos como "Provincias de" o "Del"
export function cleanDepartment(name: string): string {
  let value = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
  for (const prefix of DEPARTMENT_PREFIXES) {
    value = value.replace(prefix, '')
  }
  return value.replace(/\s+METROPOLITANA$/, '')
}

// Separa "Departamento-Provincia-Distrito" usando el primer separador que aparece; el resto va al distrito
export function splitLocation(text: string): {
  department: string
  province: string
  district: string
} {
  const separator =
    LOCATION_SEPARATORS.map((candidate) => ({ candidate, at: text.indexOf(candidate) }))
      .filter((item) => item.at >= 0)
      .sort((left, right) => left.at - right.at)[0]?.candidate ?? '-'
  const parts = text.split(separator).map((part) => part.trim().toUpperCase())
  return {
    department: cleanDepartment(parts[0] ?? ''),
    province: parts[1] ?? '',
    district: parts.slice(2).join(separator),
  }
}
