import { basename, extname } from 'node:path'

import { validateColumns, type DatasetColumn } from '@vigia/epidemiology'
import type { DataSource } from 'typeorm'

import { columnsFromMapping } from '../modules/ingestion/lib/ingest'
import { inferTopic } from '../modules/ingestion/lib/topic'
import { typedRows } from '../modules/ingestion/lib/typed-rows'
import { readTable } from '../modules/ingestion/lib/readers'
import { loadConfig, loadEnvFiles } from '../common/config/app-config'
import { createDataSource } from '../common/database/data-source'
import { LocalStorageAdapter } from '../common/storage/local-storage.adapter'
import type { StoragePort } from '../common/storage/storage.port'

const INSERT_CHUNK_SIZE = 500

interface PendingUpload {
  id: number
  filename: string
  source: string
  mapping: Record<string, string>
  raw_storage_key: string
}

// Completa columnas, título, tema y filas genéricas de las cargas creadas antes de los datasets flexibles
export async function backfillGeneric(
  dataSource: DataSource,
  storage: StoragePort,
): Promise<number> {
  const pending = await dataSource.query<PendingUpload[]>(
    `SELECT id, filename, source, mapping, raw_storage_key FROM "uploads"
     WHERE columns = '[]'::jsonb ORDER BY id`,
  )
  for (const upload of pending) {
    const table = await readTable(await storage.get(upload.raw_storage_key), upload.filename)
    const columns = safeColumns(columnsFromMapping(table, upload.mapping))
    const rows = typedRows(table.rows, columns)
    await dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM "dataset_rows" WHERE upload_id = $1', [upload.id])
      for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
        const chunk = rows.slice(start, start + INSERT_CHUNK_SIZE)
        const values = chunk.map((_, index) => `($1, $${index * 2 + 2}, $${index * 2 + 3})`)
        const params = chunk.flatMap((row, index) => [start + index + 1, JSON.stringify(row)])
        await manager.query(
          `INSERT INTO "dataset_rows" (upload_id, row_number, data) VALUES ${values.join(', ')}`,
          [upload.id, ...params],
        )
      }
      await manager.query(
        'UPDATE "uploads" SET columns = $2::jsonb, title = $3, topic = $4 WHERE id = $1',
        [
          upload.id,
          JSON.stringify(columns),
          basename(upload.filename, extname(upload.filename)),
          inferTopic(upload.filename, upload.source, upload.mapping),
        ],
      )
    })
  }
  return pending.length
}

// Aplica las reglas de unicidad sin detener el relleno si una carga no tiene columnas útiles
function safeColumns(columns: DatasetColumn[]): DatasetColumn[] {
  try {
    return validateColumns(columns)
  } catch {
    return columns
  }
}

// Ejecuta el relleno sobre la base configurada en el entorno
async function main(): Promise<void> {
  loadEnvFiles()
  const config = loadConfig()
  const dataSource = createDataSource(config)
  await dataSource.initialize()
  try {
    await dataSource.runMigrations()
    const total = await backfillGeneric(dataSource, new LocalStorageAdapter(config))
    console.log(`Cargas completadas: ${total}`)
  } finally {
    await dataSource.destroy()
  }
}

if (require.main === module) {
  void main()
}
