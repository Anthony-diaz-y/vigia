import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { canonicalJson, modelId } from './model-id'

describe('canonicalJson', () => {
  it('sorts keys and uses the Python separators', () => {
    expect(canonicalJson({ b: 1, a: [true, null, 'x'] })).toBe('{"a": [true, null, "x"], "b": 1}')
  })

  it('escapes non-ascii strings like json.dumps defaults', () => {
    expect(canonicalJson('ñ')).toBe('"\\u00f1"')
  })
})

describe('modelId', () => {
  it('is stable and sixteen hex characters', () => {
    const config = { horizon: 4, interval_alpha: 0.2 }
    const dataCut = { level: 'department', file_hashes: ['b', 'a'], min_year: 2022 }
    const first = modelId(config, dataCut)
    expect(first).toBe(modelId(config, dataCut))
    expect(first).toMatch(/^[0-9a-f]{16}$/)
    expect(createHash('sha256').update('x').digest('hex')).toHaveLength(64)
  })
})
