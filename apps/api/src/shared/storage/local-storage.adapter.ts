import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve, sep } from 'node:path'

import { Inject, Injectable } from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config/app-config'
import type { StoragePort } from './storage.port'

/** Local filesystem adapter; the only adapter until object storage is wired. */
@Injectable()
export class LocalStorageAdapter implements StoragePort {
  private readonly root: string
  private readonly rootPrefix: string

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.root = resolve(config.dataDir)
    this.rootPrefix = this.root.endsWith(sep) ? this.root : `${this.root}${sep}`
    mkdirSync(this.root, { recursive: true })
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key)
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${randomUUID()}.tmp`
    await writeFile(temporary, data)
    await rename(temporary, path)
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key))
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.pathFor(key))
      return true
    } catch {
      return false
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true })
  }

  async deletePrefix(prefix: string): Promise<void> {
    if (prefix.trim() === '') {
      throw new Error('storage prefix must not be empty')
    }
    await rm(this.pathFor(prefix), { recursive: true, force: true })
  }

  private pathFor(key: string): string {
    if (key.trim() === '' || key.includes('\0')) {
      throw new Error('invalid storage key')
    }
    if (isAbsolute(key)) {
      throw new Error('storage keys must be relative')
    }
    const normalized = key.replaceAll('\\', '/')
    if (normalized.split('/').some((segment) => segment === '..')) {
      throw new Error('storage keys must not traverse outside the data directory')
    }
    const candidate = resolve(this.root, normalized)
    if (candidate !== this.root && !candidate.startsWith(this.rootPrefix)) {
      throw new Error('storage key escapes the data directory')
    }
    return candidate
  }
}
