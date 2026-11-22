import type { ReactNode } from 'react'

import { DashboardLayout } from '@/modules/shared/components/layout'

// Layout compartido por todas las páginas del tablero
export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
