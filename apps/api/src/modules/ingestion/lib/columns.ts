import type { ColumnKind, ColumnRole, DescriptiveField, PlaceLevel } from '@vigia/epidemiology'

export interface ColumnSample {
  name: string
  samples: string[]
  kind: ColumnKind
  codes?: string[]
}

export interface ColumnSuggestion {
  column: string
  label: string | null
  role: ColumnRole
  level: PlaceLevel | null
  field: DescriptiveField | null
  reason: string | null
  values?: Record<string, string>
}

export interface DatasetSuggestion {
  title: string | null
  topic: string | null
  columns: ColumnSuggestion[]
}

export interface SuggestInput {
  filename: string
  columns: ColumnSample[]
}

export type SuggestColumns = (input: SuggestInput) => Promise<DatasetSuggestion | null>
