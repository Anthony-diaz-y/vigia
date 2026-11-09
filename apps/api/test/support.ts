import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TEST_DIR = resolve(process.cwd(), 'test')

export function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(resolve(TEST_DIR, 'snapshots', name), 'utf8')) as unknown
}

export function snapshotText(name: string): string {
  return readFileSync(resolve(TEST_DIR, 'snapshots', name), 'utf8')
}

export function fixture(name: string): Buffer {
  const raw = readFileSync(resolve(TEST_DIR, 'fixtures', name))
  return Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
}
