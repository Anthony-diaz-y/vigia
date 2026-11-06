import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AppConfig } from '../config/app-config'
import { LocalStorageAdapter } from './local-storage.adapter'

describe('LocalStorageAdapter', () => {
  let root: string
  let adapter: LocalStorageAdapter

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vigia-storage-'))
    adapter = new LocalStorageAdapter({ dataDir: root } as AppConfig)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('writes, reads, checks and deletes a key', async () => {
    await adapter.put('uploads/abc/quality.json', Buffer.from('{"ok":true}'))

    expect(await adapter.exists('uploads/abc/quality.json')).toBe(true)
    expect(await adapter.get('uploads/abc/quality.json')).toEqual(Buffer.from('{"ok":true}'))

    await adapter.delete('uploads/abc/quality.json')
    expect(await adapter.exists('uploads/abc/quality.json')).toBe(false)
  })

  it('deletes a whole prefix', async () => {
    await adapter.put('uploads/a/one.json', Buffer.from('1'))
    await adapter.put('uploads/b/two.json', Buffer.from('2'))
    await adapter.put('raw/keep.csv', Buffer.from('3'))

    await adapter.deletePrefix('uploads')

    expect(await adapter.exists('uploads/a/one.json')).toBe(false)
    expect(await adapter.exists('uploads/b/two.json')).toBe(false)
    expect(await adapter.exists('raw/keep.csv')).toBe(true)
  })

  it('rejects traversal, absolute keys and empty prefixes', async () => {
    await expect(adapter.put('../escape.txt', Buffer.from('x'))).rejects.toThrow(/traverse/)
    await expect(adapter.put('uploads/../../escape.txt', Buffer.from('x'))).rejects.toThrow(
      /traverse/,
    )
    await expect(adapter.put('/etc/passwd', Buffer.from('x'))).rejects.toThrow(/relative/)
    await expect(adapter.put('', Buffer.from('x'))).rejects.toThrow(/invalid/)
    await expect(adapter.deletePrefix(' ')).rejects.toThrow(/empty/)
  })
})
