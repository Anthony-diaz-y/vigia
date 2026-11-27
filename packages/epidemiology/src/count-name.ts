import { parseNumber } from './fields'

const COUNT_EXACT: ReadonlySet<string> = new Set(['n', 'num', 'nro', 'cas', 'cons', 'exam'])
const COUNT_PREFIXES = [
  'caso',
  'total',
  'atenc',
  'consult',
  'recuper',
  'visita',
  'examen',
  'hemograma',
  'nino',
  'persona',
  'poblacion',
  'habitante',
  'nacid',
  'nacimiento',
  'hospitalizad',
  'vacunad',
  'gestante',
  'beneficiari',
  'afiliad',
  'matriculad',
  'paciente',
  'egreso',
  'defunc',
  'fallec',
  'muerte',
]
const AVERAGE_PREFIXES = ['pct', 'porc', 'tasa', 'prom', 'media', 'edad']

// Parte un texto en palabras en minúscula y sin tildes
function words(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')
}

// Indica si el nombre o la etiqueta de una columna sugiere una cantidad que se suma (casos, atenciones…)
export function looksLikeCountName(name: string, label = ''): boolean {
  if (`${name} ${label}`.includes('%')) {
    return false
  }
  const all = [...words(name), ...words(label)]
  if (all.some((word) => AVERAGE_PREFIXES.some((prefix) => word.startsWith(prefix)))) {
    return false
  }
  return all.some(
    (word) => COUNT_EXACT.has(word) || COUNT_PREFIXES.some((prefix) => word.startsWith(prefix)),
  )
}

// Indica si todos los valores son números enteros no negativos (y hay al menos uno)
export function isWholeCount(values: readonly string[]): boolean {
  const numbers = values.map((value) => parseNumber(value))
  return numbers.length > 0 && numbers.every((n) => n !== null && Number.isInteger(n) && n >= 0)
}
