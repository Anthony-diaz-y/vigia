import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import type { GeoLevel, WeeklySeriesRow } from '@vigia/contracts'
import { DataSource } from 'typeorm'

interface WeeklyQueryRow {
  department: string
  province?: string
  year: number
  epi_week: number
  cases: string | number
}

interface ExistsRow {
  present: boolean
}

@Injectable()
export class AnalysisRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Lanza 404 si la carga pedida no existe o si no hay ninguna carga
  async assertScope(uploadId?: number): Promise<void> {
    if (uploadId !== undefined) {
      const rows = await this.dataSource.query<ExistsRow[]>(
        'SELECT EXISTS(SELECT 1 FROM "uploads" WHERE id = $1) AS present',
        [uploadId],
      )
      if (!rows[0]?.present) {
        throw new NotFoundException('carga no encontrada')
      }
      return
    }

    const rows = await this.dataSource.query<ExistsRow[]>(
      'SELECT EXISTS(SELECT 1 FROM "uploads") AS present',
    )
    if (!rows[0]?.present) {
      throw new NotFoundException('sin datos: subí un archivo de vigilancia')
    }
  }

  // Agrega en PostgreSQL los casos por geografía, año y semana
  async weeklyCases(level: GeoLevel, uploadId?: number): Promise<WeeklySeriesRow[]> {
    const geo = level === 'department' ? ['department'] : ['department', 'province']
    const selected = geo.map((column) => `"${column}"`).join(', ')
    const ordered = geo.map((column) => `"${column}" COLLATE "C"`).join(', ')
    const params: unknown[] = []
    const where = uploadId === undefined ? '' : 'WHERE "upload_id" = $1'
    if (uploadId !== undefined) {
      params.push(uploadId)
    }

    const rows = await this.dataSource.query<WeeklyQueryRow[]>(
      `
      SELECT ${selected}, "year"::int AS year, "epi_week"::int AS epi_week,
             SUM("cases")::bigint AS cases
      FROM "surveillance_cases"
      ${where}
      GROUP BY ${selected}, "year", "epi_week"
      ORDER BY ${ordered}, "year", "epi_week"
      `,
      params,
    )

    return rows.map((row) => {
      if (level === 'department') {
        return {
          department: row.department,
          year: Number(row.year),
          epi_week: Number(row.epi_week),
          cases: Number(row.cases),
        }
      }
      return {
        department: row.department,
        province: row.province ?? '',
        year: Number(row.year),
        epi_week: Number(row.epi_week),
        cases: Number(row.cases),
      }
    })
  }
}
