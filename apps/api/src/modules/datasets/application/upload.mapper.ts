import type { UploadDto } from '@vigia/contracts'
import type { UploadStatus } from '@vigia/epidemiology'

import type { UploadEntity } from '../infrastructure/persistence/upload.entity'

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
    created_at: entity.createdAt.toISOString(),
  }
}
