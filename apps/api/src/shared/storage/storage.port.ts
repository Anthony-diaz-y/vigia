export const STORAGE = Symbol('STORAGE')

/**
 * Storage port for raw uploads and generated artifacts. Keys are relative and
 * never absolute paths, so the local adapter can be replaced by object storage
 * without changing callers.
 */
export interface StoragePort {
  put(key: string, data: Buffer): Promise<void>
  get(key: string): Promise<Buffer>
  exists(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  deletePrefix(prefix: string): Promise<void>
}
