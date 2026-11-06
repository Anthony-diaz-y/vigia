import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DISCLAIMER } from './common'
import { HealthSchema } from './health'
import { QualityReportSchema, UploadSchema } from './uploads'

function repoRoot(): string {
  let current = process.cwd()
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(resolve(current, 'pnpm-workspace.yaml'))) {
      return current
    }
    const parent = resolve(current, '..')
    if (parent === current) {
      break
    }
    current = parent
  }
  throw new Error('repository root not found')
}

function snapshot(name: string): unknown {
  const path = resolve(repoRoot(), 'contract', 'snapshots', name)
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

describe('HTTP contracts', () => {
  it('parses the health snapshot and keeps the disclaimer verbatim', () => {
    const health = HealthSchema.parse(snapshot('api_health.json'))
    expect(health.disclaimer).toBe(DISCLAIMER)
  })

  it('parses every upload in the Python uploads snapshot', () => {
    const uploads = snapshot('api_uploads.json')
    expect(Array.isArray(uploads)).toBe(true)
    for (const upload of uploads as unknown[]) {
      const parsed = UploadSchema.parse(upload)
      expect(parsed.rows_in).toBe(
        parsed.rows_valid + parsed.rows_dropped + parsed.duplicates_collapsed,
      )
    }
  })

  it('parses the singular upload snapshot', () => {
    expect(() => UploadSchema.parse(snapshot('api_upload.json'))).not.toThrow()
  })

  it('parses the quality report snapshot', () => {
    const quality = QualityReportSchema.parse(snapshot('api_quality.json'))
    expect(quality.rows_in).toBe(
      quality.rows_valid + quality.rows_dropped + quality.duplicates_collapsed,
    )
  })
})
