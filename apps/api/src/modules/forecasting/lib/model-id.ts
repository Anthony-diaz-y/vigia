import { createHash } from 'node:crypto'

// Calcula el id del modelo: SHA-256 de config y corte de datos, truncado a 16 hex como en Python
export function modelId(config: object, dataCut: object): string {
  return createHash('sha256')
    .update(canonicalJson({ config, data_cut: dataCut }), 'utf8')
    .digest('hex')
    .slice(0, 16)
}

// Serializa a JSON con claves ordenadas y separadores iguales a json.dumps de Python
export function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('cannot canonicalize a non-finite number')
    }
    return String(value)
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'string') {
    return pythonJsonString(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(', ')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort()
    return `{${keys
      .map((key) => `${pythonJsonString(key)}: ${canonicalJson(record[key])}`)
      .join(', ')}}`
  }
  throw new Error(`cannot canonicalize ${typeof value}`)
}

// Serializa un string escapando caracteres no ASCII como hace json.dumps
function pythonJsonString(value: string): string {
  return JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}
