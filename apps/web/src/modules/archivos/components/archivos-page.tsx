'use client'

import { EMPTY_UPLOADS } from '@/modules/shared/constants'
import { useUploads } from '@/modules/shared/hooks'

import { IngestionTable } from './ingestion-table'

// Página de archivos: el layout ya resuelve la carga, el error y el estado vacío
export function ArchivosPage() {
  const { data: uploads = EMPTY_UPLOADS } = useUploads()
  return <IngestionTable uploads={uploads} />
}
