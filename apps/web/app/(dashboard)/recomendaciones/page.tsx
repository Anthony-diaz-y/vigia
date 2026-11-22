import type { Metadata } from 'next'

import { RecomendacionesPage } from '@/modules/recomendaciones'

export const metadata: Metadata = {
  title: 'Recomendaciones · Vigia',
}

// Página de recomendaciones: dónde actuar primero y qué esperar en los próximos años
export default function Page() {
  return <RecomendacionesPage />
}
