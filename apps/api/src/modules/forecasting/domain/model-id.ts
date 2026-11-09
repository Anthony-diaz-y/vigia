import { createHash } from 'node:crypto'

/**
 * Deterministic model identifier from the canonical config and data cut.
 *
 * Mirrors `model_id` in `src/vigia/forecast/registry.py`: SHA-256 over
 * `json.dumps({"config": ..., "data_cut": ...}, sort_keys=True, default=str)`,
 * truncated to 16 hex characters. The Python writer uses `", "` and `": "`
 * separators, so the canonicalizer below reproduces that spacing.
 */
export function modelId(config: object, dataCut: object): string {
  return createHash('sha256')
    .update(canonicalJson({ config, data_cut: dataCut }), 'utf8')
    .digest('hex')
    .slice(0, 16)
}

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

/** `json.dumps` defaults to `ensure_ascii=True`, unlike `JSON.stringify`. */
function pythonJsonString(value: string): string {
  return JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}
