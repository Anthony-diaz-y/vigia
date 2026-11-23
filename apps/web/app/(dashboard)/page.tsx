import type { Metadata } from 'next'

import { TableroPage } from '@/modules/tablero'

export const metadata: Metadata = {
  title: 'Tablero · Vigia',
}

// Página principal: tablero que se adapta a las columnas del archivo elegido
export default function Page() {
  return <TableroPage />
}
