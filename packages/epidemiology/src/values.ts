export const MISSING_VALUE = 'Sin dato'
export const YES_LABEL = 'Sí'
export const NO_LABEL = 'No'

export const MAX_VALUE_LABEL = 60
export const MAX_CODED_VALUES = 12

export interface ValueRules {
  yesNo: boolean
  missing: ReadonlySet<string>
}

const YES = new Set(['S', 'SI', 'Y', 'YES', 'TRUE', 'VERDADERO'])
const NO = new Set(['N', 'NO', 'FALSE', 'FALSO'])
const MISSING_TEXT = new Set([
  '',
  '-',
  '-1',
  'NA',
  'N/A',
  'NULL',
  'NONE',
  'ND',
  'S/D',
  'SD',
  'SIN DATO',
  'SIN INFORMACION',
  'DESCONOCIDO',
  'NO REGISTRA',
])
const YES_NO_WORDS = new Set(['notifica', 'notificado', 'priorizado', 'tiene', 'es', 'flag'])
const ALL_NINES = /^9{1,6}$/
const WHOLE = /^\d+$/
const SHORT_CODE = /^(?:\d{1,6}|[A-Za-zÑñ]{1,3})$/
const MAX_OTHERS = 30
const SENTINEL_GAP = 3

// Pasa un valor a mayúsculas sin tildes ni espacios sobrantes para compararlo
function token(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

// Indica si el encabezado se lee como una pregunta de sí o no (notifica, priorizado, tiene…)
function isYesNoHeader(header: string): boolean {
  const words = token(header)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')
  return words.some((word) => YES_NO_WORDS.has(word))
}

// Valores que equivalen a "Sin dato" en una columna: textos de ausencia y códigos 9, 99… fuera de rango
function missingValues(values: readonly string[]): Set<string> {
  const missing = new Set<string>()
  const rest = new Set<string>()
  for (const value of values) {
    const text = value.trim()
    if (MISSING_TEXT.has(token(text))) {
      missing.add(text)
    } else {
      rest.add(text)
    }
  }
  const nines = [...rest].filter((text) => ALL_NINES.test(text))
  const others = [...rest].filter((text) => !ALL_NINES.test(text))
  if (others.length === 0 || others.length > MAX_OTHERS || !others.every((t) => WHOLE.test(t))) {
    return missing
  }
  const top = Math.max(...others.map(Number))
  for (const text of nines) {
    if (Number(text) >= SENTINEL_GAP * top) {
      missing.add(text)
    }
  }
  return missing
}

// Decide cómo mostrar los valores de una columna: si es sí/no y qué valores son "Sin dato"
export function valueRules(header: string, values: readonly string[]): ValueRules {
  const missing = missingValues(values)
  const present = new Set(values.map((value) => value.trim()).filter((text) => !missing.has(text)))
  const allowNumbers = isYesNoHeader(header)
  const yesNo =
    present.size > 0 &&
    [...present].every((text) => {
      const key = token(text)
      return YES.has(key) || NO.has(key) || (allowNumbers && (key === '1' || key === '0'))
    })
  return { yesNo, missing }
}

// Valor listo para mostrar: "Sin dato", "Sí"/"No" o el valor original recortado
export function displayValue(raw: string, rules: ValueRules): string {
  const text = raw.trim()
  if (rules.missing.has(text)) {
    return MISSING_VALUE
  }
  if (rules.yesNo) {
    const key = token(text)
    return YES.has(key) || key === '1' ? YES_LABEL : NO_LABEL
  }
  return text
}

// Indica si un valor ya traducido es el "Sin dato"
export function isMissingValue(name: string): boolean {
  return name === MISSING_VALUE
}

// Valores reales (sin "Sin dato") de una columna de códigos cortos con pocos valores; vacío si no es de códigos
export function codedValues(header: string, values: readonly string[]): string[] {
  const rules = valueRules(header, values)
  const present = [...new Set(values.map((value) => value.trim()))].filter(
    (text) => !rules.missing.has(text),
  )
  const coded =
    !rules.yesNo &&
    present.length >= 2 &&
    present.length <= MAX_CODED_VALUES &&
    present.every((text) => SHORT_CODE.test(text))
  return coded ? present : []
}

// Indica si una columna es de códigos cortos con pocos valores (1, 2, 3 o A, B, C)
export function isCodedValueSet(header: string, values: readonly string[]): boolean {
  return codedValues(header, values).length > 0
}

// Limpia el significado de los códigos: solo códigos existentes y etiquetas de 1 a 60 caracteres
export function sanitizeValueLabels(
  raw: unknown,
  allowed: readonly string[],
): Record<string, string> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return undefined
  }
  const known = new Set(allowed)
  const labels: Record<string, string> = {}
  for (const [code, label] of Object.entries(raw)) {
    const text = typeof label === 'string' ? label.trim() : ''
    if (known.has(code) && text.length > 0 && text.length <= MAX_VALUE_LABEL) {
      labels[code] = text
    }
  }
  return Object.keys(labels).length > 0 ? labels : undefined
}
