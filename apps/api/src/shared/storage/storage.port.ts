export const STORAGE = Symbol('STORAGE')

export interface StoragePort {
  put(key: string, data: Buffer): Promise<void>
  get(key: string): Promise<Buffer>
  exists(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  deletePrefix(prefix: string): Promise<void>
}
