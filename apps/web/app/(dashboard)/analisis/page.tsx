import type { Metadata } from 'next'

import { AnalisisPage } from '@/modules/analisis'

export const metadata: Metadata = {
  title: 'Análisis · Vigia',
}

// Página de análisis: dónde y cuándo se concentran los casos
export default function Page() {
  return <AnalisisPage />
}
