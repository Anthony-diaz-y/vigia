declare module 'parquetjs-lite' {
  import type { Writable } from 'node:stream'

  export interface ParquetField {
    type: 'UTF8' | 'INT32' | 'INT64' | 'DOUBLE' | 'BOOLEAN' | string
    optional?: boolean
    repeated?: boolean
  }

  export class ParquetSchema {
    constructor(schema: Record<string, ParquetField>)
  }

  export class ParquetWriter {
    static openStream(
      schema: ParquetSchema,
      outputStream: Writable,
      opts?: Record<string, unknown>,
    ): Promise<ParquetWriter>
    appendRow(row: Record<string, unknown>): Promise<void>
    close(callback?: () => void): Promise<void>
    setRowGroupSize(count: number): void
  }

  export interface ParquetCursor {
    next(): Promise<Record<string, unknown> | null>
  }

  export class ParquetReader {
    static openFile(path: string): Promise<ParquetReader>
    static openBuffer(buffer: Buffer): Promise<ParquetReader>
    getCursor(): ParquetCursor
    close(): Promise<void>
  }
}
