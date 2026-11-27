import { describe, expect, it } from 'vitest'

import { planWidgets } from './dashboard'
import { summarizeDashboard, turnOnRole } from './dashboard-summary'
import type { DatasetColumn } from './roles'

// Arma una columna con valores por defecto para los tests
function column(name: string, role: DatasetColumn['role'], extra: Partial<DatasetColumn> = {}) {
  return {
    name,
    label: '',
    role,
    level: null,
    field: null,
    kind: 'text',
    ...extra,
  } as DatasetColumn
}

const FULL = [
  column('fecha', 'date', { label: 'Fecha', kind: 'date' }),
  column('distrito', 'place', { level: 'district', label: 'Distrito' }),
  column('sexo', 'category', { label: 'Sexo' }),
  column('hb', 'measure', { label: 'Hemoglobina', kind: 'number' }),
  column('dni', 'identifier'),
]

// Ids de los widgets del resumen
function ids(columns: readonly DatasetColumn[]): string[] {
  return summarizeDashboard(columns).widgets.map((widget) => widget.id)
}

describe('summarizeDashboard', () => {
  it('con tiempo, lugar y medidas lista cada gráfico y el pronóstico', () => {
    const summary = summarizeDashboard(FULL)
    expect(ids(FULL)).toEqual([
      'kpis',
      'timeseries',
      'interannual',
      'ranking',
      'heatmap',
      'breakdown:sexo',
      'histogram:hb',
      'indicators',
      'forecast',
    ])
    expect(summary.usable).toBe(true)
    expect(summary.warnings).toEqual([
      'Sin una columna de cantidad, cada fila cuenta como un registro.',
    ])
    expect(summary.indicators.map((item) => item.label)).toEqual([
      'Registros',
      'Hemoglobina promedio',
    ])
  })

  it('usa los mismos widgets que planWidgets, la decisión que usa la API', () => {
    const planned = planWidgets(
      {
        columns: FULL,
        rows: 2,
        periods: 2,
        places: 2,
        years: 2,
        distinct: { sexo: 5, hb: 5 },
      },
      { kind: 'records' },
      'month',
    ).map((widget) => widget.id)
    expect(ids(FULL).filter((id) => planned.includes(id))).toEqual(planned)
  })

  it('refleja el nivel de lugar en el ranking', () => {
    const ranking = (level: DatasetColumn['level']) =>
      summarizeDashboard([column('l', 'place', { level }), column('f', 'date')]).widgets.find(
        (widget) => widget.id === 'ranking',
      )?.title
    expect(ranking('province')).toBe('Registros por provincia')
    expect(ranking('district')).toBe('Registros por distrito')
    expect(ranking('department')).toBe('Registros por departamento')
  })

  it('sin tiempo no hay evolución ni pronóstico y avisa', () => {
    const columns = FULL.map((item) =>
      item.role === 'date' ? { ...item, role: 'ignore' as const } : item,
    )
    const summary = summarizeDashboard(columns)
    expect(summary.widgets.map((widget) => widget.id)).toEqual([
      'kpis',
      'ranking',
      'breakdown:sexo',
      'histogram:hb',
      'indicators',
    ])
    expect(summary.warnings).toEqual([
      'Sin una columna de tiempo no habrá evolución ni pronóstico.',
      'Sin una columna de cantidad, cada fila cuenta como un registro.',
    ])
  })

  it('una semana sin año no alcanza para la evolución', () => {
    const summary = summarizeDashboard([column('s', 'week'), column('c', 'category')])
    expect(summary.warnings[0]).toBe(
      'Para ver la evolución hace falta una fecha, o un año junto con una semana o un mes.',
    )
    expect(summary.forecast).toBe(false)
  })

  it('año solo da evolución anual sin pronóstico', () => {
    const summary = summarizeDashboard([column('a', 'year', { label: 'Año' })])
    expect(summary.widgets.find((widget) => widget.id === 'timeseries')?.title).toBe(
      'Registros por año',
    )
    expect(summary.forecast).toBe(false)
    expect(summary.widgets.some((widget) => widget.id === 'forecast')).toBe(false)
  })

  it('sin lugar no hay ranking por zona y avisa', () => {
    const columns = FULL.map((item) =>
      item.role === 'place' ? { ...item, role: 'ignore' as const } : item,
    )
    expect(ids(columns)).not.toContain('ranking')
    expect(ids(columns)).not.toContain('heatmap')
    expect(summarizeDashboard(columns).warnings).toEqual([
      'Sin una columna de lugar no habrá ranking por zona.',
      'Sin una columna de cantidad, cada fila cuenta como un registro.',
    ])
  })

  it('sin cantidad cada fila cuenta como un registro y con cantidad se suma', () => {
    const counted = [...FULL, column('n', 'count', { kind: 'number' })]
    expect(summarizeDashboard(counted).warnings).toEqual([])
    const withoutCount = summarizeDashboard([column('f', 'date'), column('x', 'category')])
    expect(withoutCount.warnings).toEqual([
      'Sin una columna de lugar no habrá ranking por zona.',
      'Sin una columna de cantidad, cada fila cuenta como un registro.',
    ])
    const withCount = summarizeDashboard([
      column('f', 'date'),
      column('n', 'count', { label: 'Casos', kind: 'number' }),
    ])
    expect(withCount.indicators.map((item) => item.label)).toEqual(['Registros', 'Total de casos'])
    expect(withCount.widgets.find((widget) => widget.id === 'ranking')).toBeUndefined()
  })

  it('el pronóstico depende del tiempo: fecha, año con semana o año con mes', () => {
    expect(summarizeDashboard([column('f', 'date')]).forecast).toBe(true)
    expect(summarizeDashboard([column('y', 'year'), column('w', 'week')]).forecast).toBe(true)
    expect(summarizeDashboard([column('y', 'year'), column('m', 'month')]).forecast).toBe(true)
  })

  it('un identificador bloqueado no aparece en ningún gráfico', () => {
    const summary = summarizeDashboard(FULL)
    expect(summary.widgets.flatMap((widget) => widget.columns)).not.toContain('dni')
  })

  it('con todo sin usar no hay nada que mostrar', () => {
    const summary = summarizeDashboard([column('a', 'ignore'), column('b', 'identifier')])
    expect(summary).toEqual({
      widgets: [],
      indicators: [],
      forecast: false,
      usable: false,
      warnings: [],
    })
  })
})

describe('turnOnRole', () => {
  it('un número se usa como indicador para medir', () => {
    expect(turnOnRole('number')).toBe('measure')
  })

  it('un número entero con nombre de cantidad se usa como cantidad', () => {
    const hint = { name: 'casos_2024', samples: ['3', '10', '0'] }
    expect(turnOnRole('number', hint)).toBe('count')
  })

  it('un número con decimales o con nombre de promedio sigue siendo indicador', () => {
    expect(turnOnRole('number', { name: 'casos', samples: ['3,5', '10'] })).toBe('measure')
    expect(turnOnRole('number', { name: 'edad_media', samples: ['3', '10'] })).toBe('measure')
    expect(turnOnRole('number', { name: 'altura', samples: ['3', '10'] })).toBe('measure')
  })

  it('un texto se usa para agrupar', () => {
    expect(turnOnRole('text')).toBe('category')
  })

  it('una fecha se usa como fecha', () => {
    expect(turnOnRole('date')).toBe('date')
  })
})
