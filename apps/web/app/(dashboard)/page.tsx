import type { Metadata } from 'next'

import { ResumenPage } from '@/modules/resumen'

export const metadata: Metadata = {
  title: 'Resumen · Vigia',
}

// Página principal: cómo viene la semana, de un vistazo
export default function Page() {
  return <ResumenPage />
}
