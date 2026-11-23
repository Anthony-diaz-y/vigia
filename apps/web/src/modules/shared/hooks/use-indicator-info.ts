import type { UploadDto } from '@vigia/contracts'

import { useDashboardFilters } from '../contexts'

export interface IndicatorInfo {
  id: string
  label: string
  unit: string
  decimals: number
  mean: boolean
}

// Indicador por defecto de un archivo: el total de su columna de cantidad o, si no tiene, los registros
export function defaultIndicatorId(upload: UploadDto | null): string {
  return upload?.indicators.find((option) => option.id.startsWith('sum:'))?.id ?? 'records'
}

// Nombre, unidad y decimales del indicador elegido; "casos" para el indicador por defecto del dengue
export function useIndicatorInfo(): IndicatorInfo {
  const { upload, indicator } = useDashboardFilters()
  const id = indicator ?? defaultIndicatorId(upload)
  const label = upload?.indicators.find((option) => option.id === id)?.label ?? 'Registros'
  const dengueCases = /dengue/i.test(upload?.topic ?? '') && id === defaultIndicatorId(upload)
  const mean = id.startsWith('mean:')
  return {
    id,
    label: dengueCases ? 'Casos' : label,
    unit: dengueCases ? 'casos' : label.charAt(0).toLowerCase() + label.slice(1),
    decimals: mean ? 1 : 0,
    mean,
  }
}
