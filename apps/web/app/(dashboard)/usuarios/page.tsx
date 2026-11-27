import type { Metadata } from 'next'

import { UsuariosPage } from '@/modules/usuarios'

export const metadata: Metadata = {
  title: 'Usuarios · Vigia',
}

// Página de usuarios: cuentas con acceso a Vigia
export default function Page() {
  return <UsuariosPage />
}
