import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'
import type { ClearUploadsResponse, QualityReportDto, UploadDto } from '@vigia/contracts'
import type { UploadStatus } from '@vigia/epidemiology'
import { DataSource, Repository } from 'typeorm'

import { STORAGE, type StoragePort } from '../../../shared/storage/storage.port'
import { QualityIssueEntity } from '../infrastructure/persistence/quality-issue.entity'
import { UploadEntity } from '../infrastructure/persistence/upload.entity'

function toUploadDto(entity: UploadEntity): UploadDto {
  return {
    id: entity.id,
    file_hash: entity.fileHash,
    filename: entity.filename,
    source: entity.source,
    status: entity.status as UploadStatus,
    rows_in: entity.rowsIn,
    rows_valid: entity.rowsValid,
    rows_dropped: entity.rowsDropped,
    duplicates_collapsed: entity.duplicatesCollapsed,
    created_at: entity.createdAt.toISOString(),
  }
}

function toQualityReport(upload: UploadEntity, issues: QualityIssueEntity[]): QualityReportDto {
  return {
    rows_in: upload.rowsIn,
    rows_valid: upload.rowsValid,
    rows_dropped: upload.rowsDropped,
    duplicates_collapsed: upload.duplicatesCollapsed,
    mapped_columns: upload.mapping,
    unmapped_columns: upload.unmappedColumns,
    issues: issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      count: issue.count,
      sample: issue.sample,
    })),
    source_format: upload.sourceFormat,
    encoding: upload.encoding,
    delimiter: upload.delimiter,
    file_hash: upload.fileHash,
  }
}

@Injectable()
export class DatasetsService {
  constructor(
    @InjectRepository(UploadEntity)
    private readonly uploads: Repository<UploadEntity>,
    @InjectRepository(QualityIssueEntity)
    private readonly issues: Repository<QualityIssueEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(STORAGE)
    private readonly storage: StoragePort,
  ) {}

  async list(): Promise<UploadDto[]> {
    const rows = await this.uploads.find({ order: { id: 'DESC' } })
    return rows.map(toUploadDto)
  }

  async quality(uploadId: number): Promise<QualityReportDto> {
    const upload = await this.uploads.findOne({ where: { id: uploadId } })
    if (!upload) {
      throw new NotFoundException('carga no encontrada')
    }
    const issues = await this.issues.find({
      where: { uploadId },
      order: { position: 'ASC' },
    })
    return toQualityReport(upload, issues)
  }

  async clear(): Promise<ClearUploadsResponse> {
    await this.dataSource.query('TRUNCATE TABLE "uploads" RESTART IDENTITY CASCADE')
    await Promise.all([
      this.storage.deletePrefix('raw'),
      this.storage.deletePrefix('uploads'),
      this.storage.deletePrefix('registry'),
    ])
    return { cleared: true }
  }
}
