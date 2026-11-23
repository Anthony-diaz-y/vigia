import type { AnomalyRow, UploadDto, WeeklySeriesRow } from '@vigia/contracts'

// Arreglos vacíos estables para evitar recrearlos en cada render
export const EMPTY_UPLOADS: ReadonlyArray<UploadDto> = []
export const EMPTY_SERIES: ReadonlyArray<WeeklySeriesRow> = []
export const EMPTY_ANOMALIES: ReadonlyArray<AnomalyRow> = []
export const EMPTY_YEARS: ReadonlyArray<number> = []
