import { createHash } from 'node:crypto'
import { extname } from 'node:path'

import { Inject, Injectable } from '@nestjs/common'
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'
import type { QualityReportDto, UploadDto, UploadPreview } from '@vigia/contracts'
import { KEY_COLUMNS } from '@vigia/epidemiology'
import { DataSource, Repository } from 'typeorm'

import { STORAGE, type StoragePort } from '../../../shared/storage/storage.port'
import { DatasetRowEntity } from '../../datasets/infrastructure/persistence/dataset-row.entity'
import { QualityIssueEntity } from '../../datasets/infrastructure/persistence/quality-issue.entity'
import { SurveillanceCaseEntity } from '../../datasets/infrastructure/persistence/surveillance-case.entity'
import { UploadEntity } from '../../datasets/infrastructure/persistence/upload.entity'
import { toUploadDto } from '../../datasets/application/upload.mapper'
import { ColumnAdvisor } from '../infrastructure/column-advisor'
import { ingestUpload, previewUpload, type IngestRequest, type IngestResult } from './ingest'
import type { CanonicalRow } from '../infrastructure/normalize'

const INSERT_CHUNK_SIZE = 500

export type UploadReview = Pick<IngestRequest, 'mappingOverride' | 'columns' | 'title' | 'topic'>

@Injectable()
export class IngestionService {
  constructor(
    @InjectRepository(UploadEntity)
    private readonly uploads: Repository<UploadEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(STORAGE)
    private readonly storage: StoragePort,
    @Inject(ColumnAdvisor)
    private readonly advisor: ColumnAdvisor,
  ) {}

  // Ingiere un archivo, guarda el crudo y el reporte, y persiste la carga con sus filas
  async ingest(
    data: Buffer,
    filename: string,
    source: string,
    review: UploadReview = {},
  ): Promise<UploadDto> {
    const result = await ingestUpload({ data, filename, source, ...review })

    const rawKey = `raw/${result.fileHash}${rawSuffix(filename)}`
    const qualityKey = `uploads/${result.fileHash.slice(0, 16)}/quality.json`
    await this.storage.put(rawKey, data)
    await this.storage.put(
      qualityKey,
      Buffer.from(JSON.stringify(qualityPayload(result), null, 2), 'utf8'),
    )

    const existing = await this.uploads.findOne({
      where: { fileHash: result.fileHash },
    })
    if (existing) {
      return toUploadDto(existing)
    }

    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const upload = manager.create(UploadEntity, {
          fileHash: result.fileHash,
          filename,
          source,
          status: result.status,
          rowsIn: result.rowsIn,
          rowsValid: result.rowsValid,
          rowsDropped: result.rowsDropped,
          duplicatesCollapsed: result.duplicatesCollapsed,
          mapping: result.mapping,
          unmappedColumns: result.unmappedColumns,
          title: result.title,
          topic: result.topic,
          columns: result.columns,
          epi: result.epi,
          sourceFormat: result.sourceFormat,
          encoding: result.encoding,
          delimiter: result.delimiter,
          rawStorageKey: rawKey,
          normalizedStorageKey: null,
          qualityStorageKey: qualityKey,
        })
        await manager.save(upload)

        if (result.issues.length > 0) {
          const issues = result.issues.map((issue, index) =>
            manager.create(QualityIssueEntity, {
              uploadId: upload.id,
              position: index + 1,
              code: issue.code,
              message: issue.message,
              count: issue.count,
              sample: issue.sample,
            }),
          )
          await manager.save(issues)
        }

        const caseRows = result.rows.map((row) => ({
          uploadId: upload.id,
          disease: row.disease,
          ubigeo: row.ubigeo,
          year: row.year,
          epiWeek: row.epi_week,
          department: row.department,
          province: row.province,
          district: row.district,
          directorate: row.directorate,
          sex: row.sex,
          ageGroup: row.age_group,
          ageType: row.age_type,
          diagnosis: row.diagnosis,
          diagnosisType: row.diagnosis_type,
          cases: row.cases,
          naturalKey: naturalKey(row),
        }))

        const datasetRows = result.genericRows.map((row, index) => ({
          uploadId: upload.id,
          rowNumber: index + 1,
          data: row,
        }))
        for (let index = 0; index < datasetRows.length; index += INSERT_CHUNK_SIZE) {
          await manager
            .createQueryBuilder()
            .insert()
            .into(DatasetRowEntity)
            .values(datasetRows.slice(index, index + INSERT_CHUNK_SIZE))
            .execute()
        }

        for (let index = 0; index < caseRows.length; index += INSERT_CHUNK_SIZE) {
          await manager
            .createQueryBuilder()
            .insert()
            .into(SurveillanceCaseEntity)
            .values(caseRows.slice(index, index + INSERT_CHUNK_SIZE))
            .execute()
        }

        return upload
      })

      return toUploadDto(saved)
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.uploads.findOne({
          where: { fileHash: result.fileHash },
        })
        if (raced) {
          return toUploadDto(raced)
        }
      }
      throw error
    }
  }

  // Devuelve la vista previa con la sugerencia de la IA para cada columna, sin persistir nada
  preview(data: Buffer, filename: string, source: string): Promise<UploadPreview> {
    return previewUpload({ data, filename, source }, (input) => this.advisor.suggest(input))
  }
}

// Devuelve la extensión segura del archivo o .csv por defecto
function rawSuffix(filename: string): string {
  const suffix = extname(filename).toLowerCase()
  return /^\.[a-z0-9]{1,10}$/.test(suffix) ? suffix : '.csv'
}

// Calcula el hash SHA-256 de las columnas clave de una fila
function naturalKey(row: CanonicalRow): string {
  const payload = JSON.stringify(KEY_COLUMNS.map((column) => row[column]))
  return createHash('sha256').update(payload).digest('hex')
}

// Construye el reporte de calidad que se guarda como JSON
function qualityPayload(result: IngestResult): QualityReportDto {
  return {
    rows_in: result.rowsIn,
    rows_valid: result.rowsValid,
    rows_dropped: result.rowsDropped,
    duplicates_collapsed: result.duplicatesCollapsed,
    mapped_columns: result.mapping,
    unmapped_columns: result.unmappedColumns,
    issues: result.issues,
    source_format: result.sourceFormat,
    encoding: result.encoding,
    delimiter: result.delimiter,
    file_hash: result.fileHash,
  }
}

// Indica si el error es una violación de unicidad de PostgreSQL (23505)
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const candidate = error as { code?: string; driverError?: { code?: string } }
  return candidate.code === '23505' || candidate.driverError?.code === '23505'
}
