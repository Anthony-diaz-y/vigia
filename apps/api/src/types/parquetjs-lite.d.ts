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
    // Abre un escritor Parquet que vuelca en un stream
    static openStream(
      schema: ParquetSchema,
      outputStream: Writable,
      opts?: Record<string, unknown>,
    ): Promise<ParquetWriter>
    // Agrega una fila al archivo
    appendRow(row: Record<string, unknown>): Promise<void>
    // Cierra el escritor y termina el archivo
    close(callback?: () => void): Promise<void>
    // Define cuántas filas van en cada grupo
    setRowGroupSize(count: number): void
  }

  export interface ParquetCursor {
    next(): Promise<Record<string, unknown> | null>
  }

  export class ParquetReader {
    // Abre un archivo Parquet desde disco
    static openFile(path: string): Promise<ParquetReader>
    // Abre un archivo Parquet desde memoria
    static openBuffer(buffer: Buffer): Promise<ParquetReader>
    // Devuelve un cursor para recorrer las filas
    getCursor(): ParquetCursor
    // Cierra el lector
    close(): Promise<void>
  }
}
