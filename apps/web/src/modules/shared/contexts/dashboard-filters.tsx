'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

interface DashboardFilters {
  uploadId: number | null
  year: number | null
}

const DashboardFiltersContext = createContext<DashboardFilters | null>(null)

// Comparte el archivo y el año seleccionados con la página que se está mostrando
export function DashboardFiltersProvider({
  uploadId,
  year,
  children,
}: DashboardFilters & { children: ReactNode }) {
  const value = useMemo<DashboardFilters>(() => ({ uploadId, year }), [uploadId, year])

  return (
    <DashboardFiltersContext.Provider value={value}>{children}</DashboardFiltersContext.Provider>
  )
}

// Lee los filtros activos; solo funciona dentro del layout del tablero
export function useDashboardFilters(): DashboardFilters {
  const value = useContext(DashboardFiltersContext)
  if (!value) {
    throw new Error('useDashboardFilters debe usarse dentro de <DashboardLayout>')
  }
  return value
}
