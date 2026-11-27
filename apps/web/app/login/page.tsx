import type { Metadata } from 'next'
import { Suspense } from 'react'

import { LoginPage } from '@/modules/login'

export const metadata: Metadata = {
  title: 'Iniciar sesión · Vigia',
}

// Página de inicio de sesión
export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  )
}
