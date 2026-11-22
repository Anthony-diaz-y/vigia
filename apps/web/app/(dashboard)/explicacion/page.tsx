import type { Metadata } from 'next'

import { ExplicacionPage } from '@/modules/explicacion'

export const metadata: Metadata = {
  title: 'Explicación · Vigia',
}

// Página de explicación: qué factores mueven el pronóstico en cada departamento
export default function Page() {
  return <ExplicacionPage />
}
