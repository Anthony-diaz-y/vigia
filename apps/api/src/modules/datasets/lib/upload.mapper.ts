import type { UploadDto } from '@vigia/contracts'
import { indicatorOptions, timeSupport, type UploadStatus } from '@vigia/epidemiology'

import type { UploadEntity } from '../entities/upload.entity'

// Convierte la entidad de carga en el DTO que devuelve la API
export function toUploadDto(entity: UploadEntity): UploadDto {
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
    title: entity.title,
    topic: entity.topic,
    columns: entity.columns,
    time: timeSupport(entity.columns),
    epi: entity.epi,
    indicators: indicatorOptions(entity.columns).map(({ id, label }) => ({ id, label })),
    created_at: entity.createdAt.toISOString(),
  }
}
