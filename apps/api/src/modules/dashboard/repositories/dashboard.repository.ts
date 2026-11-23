import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import type { DatasetColumn } from '@vigia/epidemiology'
import { DataSource } from 'typeorm'

import type { DataRow } from '../lib/dashboard-data'

export interface DatasetSnapshot {
  title: string
  topic: string
  epi: boolean
  columns: DatasetColumn[]
  rows: DataRow[]
}

@Injectable()
export class DashboardRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Lee el título, el tema, la capa epidemiológica y las columnas de una carga; 404 si no existe
  async meta(uploadId: number): Promise<Omit<DatasetSnapshot, 'rows'>> {
    const uploads = await this.dataSource.query<Array<Omit<DatasetSnapshot, 'rows'>>>(
      'SELECT title, topic, epi, columns FROM "uploads" WHERE id = $1',
      [uploadId],
    )
    const upload = uploads[0]
    if (!upload) {
      throw new NotFoundException('carga no encontrada')
    }
    return upload
  }

  // Lee los datos de la carga junto con todas sus filas genéricas
  async dataset(uploadId: number): Promise<DatasetSnapshot> {
    const upload = await this.meta(uploadId)
    const rows = await this.dataSource.query<Array<{ data: DataRow }>>(
      'SELECT data FROM "dataset_rows" WHERE upload_id = $1 ORDER BY row_number',
      [uploadId],
    )
    return { ...upload, rows: rows.map((row) => row.data) }
  }

  // Años con datos calculados en PostgreSQL, sin traer las filas a memoria
  async years(uploadId: number): Promise<number[]> {
    const { columns } = await this.meta(uploadId)
    const date = columns.find((column) => column.role === 'date')
    const year = columns.find((column) => column.role === 'year')
    const source = date ?? year
    if (!source) {
      return []
    }
    const expression = date ? 'substring(data->>$2, 1, 4)::int' : 'floor((data->>$2)::numeric)::int'
    const rows = await this.dataSource.query<Array<{ year: number }>>(
      `SELECT DISTINCT ${expression} AS year FROM "dataset_rows"
       WHERE upload_id = $1 AND data->>$2 IS NOT NULL
       ORDER BY year DESC`,
      [uploadId, source.name],
    )
    return rows.map((row) => Number(row.year))
  }
}
