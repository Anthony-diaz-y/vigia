import { UBIGEO_DEPARTMENTS, UBIGEO_DISTRICTS, UBIGEO_PROVINCES } from './ubigeo/catalog'

export type UbigeoLevel = 'department' | 'province' | 'district'

const CATALOGS: Readonly<Record<UbigeoLevel, Readonly<Record<string, string>>>> = {
  department: UBIGEO_DEPARTMENTS,
  province: UBIGEO_PROVINCES,
  district: UBIGEO_DISTRICTS,
}
const LEVEL_BY_LENGTH: Readonly<Record<number, UbigeoLevel>> = {
  2: 'department',
  4: 'province',
  6: 'district',
}
const LEVEL_WORDS: Readonly<Record<string, UbigeoLevel>> = {
  dep: 'department',
  dpto: 'department',
  depto: 'department',
  departamento: 'department',
  prov: 'province',
  provincia: 'province',
  dist: 'district',
  distrito: 'district',
}
const CODE_WORDS: ReadonlySet<string> = new Set(['cod', 'codigo', 'code', 'id', 'ubigeo'])
const MIN_RESOLVED_RATIO = 0.9
let repeatedDistricts: ReadonlySet<string> | null = null

// Deja solo los dígitos de un código y restaura el cero inicial que se pierde al leerlo como número
function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null
  }
  const digits = /^(\d+)(?:\.0+)?$/.exec(String(value).trim())?.[1]
  return digits === undefined ? null : digits.length % 2 === 1 ? `0${digits}` : digits
}

// Nombre del lugar de un código UBIGEO del INEI (por su longitud o por el nivel pedido); null si no existe
export function resolveUbigeo(value: unknown, level?: UbigeoLevel): string | null {
  const code = normalizeCode(value)
  const found = code === null ? undefined : LEVEL_BY_LENGTH[code.length]
  if (code === null || found === undefined || (level !== undefined && level !== found)) {
    return null
  }
  return CATALOGS[found][code] ?? null
}

// Nombres de distrito que existen en más de una provincia y por eso necesitan la provincia
function repeated(): ReadonlySet<string> {
  if (repeatedDistricts === null) {
    const seen = new Set<string>()
    const twice = new Set<string>()
    for (const name of Object.values(UBIGEO_DISTRICTS)) {
      ;(seen.has(name) ? twice : seen).add(name)
    }
    repeatedDistricts = twice
  }
  return repeatedDistricts
}

// Nombre para mostrar de un código: al distrito repetido le agrega su provincia ("San Jeronimo, Andahuaylas")
export function ubigeoPlaceName(value: unknown): string | null {
  const name = resolveUbigeo(value)
  const code = normalizeCode(value)
  if (name === null || code === null || code.length !== 6 || !repeated().has(name)) {
    return name
  }
  const province = UBIGEO_PROVINCES[code.slice(0, 4)]
  return province ? `${name}, ${province}` : name
}

// Nivel de los códigos de una columna si al menos el 90 % de sus valores llenos existe en el catálogo; si no, null
export function detectUbigeoLevel(values: readonly unknown[]): UbigeoLevel | null {
  const filled = values.filter((value) => String(value ?? '').trim() !== '')
  if (filled.length === 0) {
    return null
  }
  for (const level of Object.values(LEVEL_BY_LENGTH)) {
    const resolved = filled.filter((value) => resolveUbigeo(value, level) !== null).length
    if (resolved / filled.length >= MIN_RESOLVED_RATIO) {
      return level
    }
  }
  return null
}

// Nivel de lugar que anuncia un encabezado de código (cod_prov, codigo_distrito…); null si no es uno
export function ubigeoHeaderLevel(header: string): UbigeoLevel | null {
  const words = header
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')
  const levels = new Set(words.flatMap((word) => LEVEL_WORDS[word] ?? []))
  const [level] = [...levels]
  return levels.size === 1 && words.some((word) => CODE_WORDS.has(word)) ? (level ?? null) : null
}
