import { describe, expect, it } from 'vitest'

import { DashboardResponseSchema } from './dashboard'
import { DatasetColumnSchema, PreviewColumnSchema } from './uploads'

const COLUMN = {
  name: 'ESTADO',
  label: 'Estado',
  role: 'category',
  level: null,
  field: null,
  kind: 'number',
}

describe('significado de los valores de una columna', () => {
  it('acepta una columna sin values (cargas antiguas) y con values', () => {
    expect(DatasetColumnSchema.parse(COLUMN)).toEqual(COLUMN)
    const withValues = { ...COLUMN, values: { '1': 'Activo', '2': 'Inactivo' } }
    expect(DatasetColumnSchema.parse(withValues)).toEqual(withValues)
  })

  it('rechaza etiquetas vacías o de más de 60 caracteres y valores que no son texto', () => {
    expect(DatasetColumnSchema.safeParse({ ...COLUMN, values: { '1': '' } }).success).toBe(false)
    expect(
      DatasetColumnSchema.safeParse({ ...COLUMN, values: { '1': 'x'.repeat(61) } }).success,
    ).toBe(false)
    expect(DatasetColumnSchema.safeParse({ ...COLUMN, values: { '1': 5 } }).success).toBe(false)
    expect(DatasetColumnSchema.safeParse({ ...COLUMN, values: ['Activo'] }).success).toBe(false)
  })

  it('acepta una etiqueta de exactamente 60 caracteres', () => {
    const values = { '1': 'x'.repeat(60) }
    expect(DatasetColumnSchema.safeParse({ ...COLUMN, values }).success).toBe(true)
  })

  it('la vista previa admite values y la lista de códigos', () => {
    const preview = {
      ...COLUMN,
      values: { '1': 'Activo' },
      codes: ['1', '2'],
      samples: ['1'],
      reason: null,
    }
    expect(PreviewColumnSchema.parse(preview)).toEqual(preview)
    expect(PreviewColumnSchema.safeParse({ ...COLUMN, samples: [], reason: null }).success).toBe(
      true,
    )
  })
})

describe('desglose del tablero', () => {
  const base = {
    title: 'T',
    topic: 't',
    indicator: { id: 'records', label: 'Registros' },
    indicators: [],
    granularity: null,
    years: [],
    insights: [],
  }

  it('acepta un desglose sin variant ni label y con ellos', () => {
    const old = { type: 'breakdown', id: 'a', title: 'A', rows: [{ name: 'NO', value: 1 }] }
    const next = {
      type: 'breakdown',
      id: 'b',
      title: 'B',
      variant: 'dominant',
      rows: [{ name: '1', label: 'Activo', value: 3 }],
    }
    const parsed = DashboardResponseSchema.parse({ ...base, widgets: [old, next] })
    expect(parsed.widgets).toEqual([old, next])
  })

  it('rechaza una variante desconocida', () => {
    const widget = { type: 'breakdown', id: 'a', title: 'A', variant: 'pie', rows: [] }
    expect(DashboardResponseSchema.safeParse({ ...base, widgets: [widget] }).success).toBe(false)
  })
})
