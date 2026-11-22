import type { Metadata } from 'next'

import { PronosticoPage } from '@/modules/pronostico'

export const metadata: Metadata = {
  title: 'Pronóstico · Vigia',
}

// Página de pronóstico: casos esperados en las próximas semanas
export default function Page() {
  return <PronosticoPage />
}
