import type { Metadata } from 'next'

import { ArchivosPage } from '@/modules/archivos'

export const metadata: Metadata = {
  title: 'Archivos · Vigia',
}

// Página de archivos: archivos cargados y la calidad de sus datos
export default function Page() {
  return <ArchivosPage />
}
