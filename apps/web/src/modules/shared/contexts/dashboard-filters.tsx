'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

import type { UploadDto } from '@vigia/contracts'

interface DashboardFilters {
  upload: UploadDto | null
  uploadId: number | null
  year: number | null
  yearsReady: boolean
  indicator: string | null
}

const DashboardFiltersContext = createContext<DashboardFilters | null>(null)

// Comparte el archivo, el año y el indicador elegidos con la página que se está mostrando
export function DashboardFiltersProvider({
  upload,
  year,
  yearsReady,
  indicator,
  children,
}: Omit<DashboardFilters, 'uploadId'> & { children: ReactNode }) {
  const value = useMemo<DashboardFilters>(
    () => ({ upload, uploadId: upload?.id ?? null, year, yearsReady, indicator }),
    [upload, year, yearsReady, indicator],
  )

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
