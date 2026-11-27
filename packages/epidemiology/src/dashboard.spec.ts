import { describe, expect, it } from 'vitest'

import {
  chooseGranularity,
  defaultIndicator,
  indicatorOptions,
  parseIndicator,
  placeColumn,
  planWidgets,
  topWithOthers,
  type DatasetFacts,
} from './dashboard'
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

const ANEMIA = [
  column('distrito', 'place', { level: 'district', label: 'Distrito' }),
  column('sexo', 'category', { label: 'Sexo' }),
  column('hemoglobina', 'measure', { label: 'Hemoglobina', kind: 'number' }),
  column('anemia', 'category'),
  column('nro_registro', 'identifier'),
]

const EGRESOS = [
  column('fecing', 'date', { label: 'Fecha de ingreso' }),
  column('PROCEDENCIA', 'place', { level: 'location' }),
  column('sexo', 'category'),
  column('edad', 'measure', { label: 'Edad' }),
]

// Hechos mínimos de un dataset para planear widgets
function facts(columns: DatasetColumn[], extra: Partial<DatasetFacts> = {}): DatasetFacts {
  return {
    columns,
    rows: 100,
    periods: 30,
    places: 6,
    years: 1,
    distinct: { sexo: 2, anemia: 2, hemoglobina: 40, edad: 60 },
    ...extra,
  }
}

describe('indicators', () => {
  it('indicador por defecto suma la cantidad', () => {
    expect(defaultIndicator([column('casos', 'count')])).toEqual({ kind: 'sum', column: 'casos' })
    expect(defaultIndicator(ANEMIA)).toEqual({ kind: 'records' })
  })

  it('ofrece registros y el promedio de cada valor medido', () => {
    expect(indicatorOptions(ANEMIA)).toEqual([
      { id: 'records', label: 'Registros', indicator: { kind: 'records' } },
      {
        id: 'mean:hemoglobina',
        label: 'Hemoglobina promedio',
        indicator: { kind: 'mean', column: 'hemoglobina' },
      },
    ])
  })

  it('ordena registros, luego totales y al final promedios', () => {
    const ids = indicatorOptions([column('edad', 'measure'), column('casos', 'count')]).map(
      (option) => option.id,
    )
    expect(ids).toEqual(['records', 'sum:casos', 'mean:edad'])
  })

  it('con varias cantidades usa la primera por defecto y ofrece la suma de cada una', () => {
    const columns = [column('casos', 'count'), column('casos_2024', 'count')]
    expect(defaultIndicator(columns)).toEqual({ kind: 'sum', column: 'casos' })
    expect(indicatorOptions(columns).map((option) => option.id)).toEqual([
      'records',
      'sum:casos',
      'sum:casos_2024',
    ])
  })

  it('lee un indicador desde su id y vuelve al de por defecto si no existe', () => {
    expect(parseIndicator('mean:hemoglobina', ANEMIA)).toEqual({
      kind: 'mean',
      column: 'hemoglobina',
    })
    expect(parseIndicator('mean:inventada', ANEMIA)).toEqual({ kind: 'records' })
    expect(parseIndicator(undefined, ANEMIA)).toEqual({ kind: 'records' })
  })
})

describe('granularity', () => {
  it('granularidad por rango', () => {
    expect(chooseGranularity('date', '2026-01-01', '2026-03-01')).toBe('day')
    expect(chooseGranularity('date', '2024-01-01', '2025-12-31')).toBe('week')
    expect(chooseGranularity('date', '2019-01-01', '2024-12-31')).toBe('month')
    expect(chooseGranularity('week', null, null)).toBe('week')
    expect(chooseGranularity('month', null, null)).toBe('month')
    expect(chooseGranularity('year', null, null)).toBe('year')
    expect(chooseGranularity('none', null, null)).toBeNull()
  })
})

describe('placeColumn', () => {
  it('elige el lugar de nivel más alto y trata la ubicación como departamento', () => {
    expect(placeColumn(EGRESOS)).toEqual({ column: 'PROCEDENCIA', level: 'department' })
    expect(placeColumn(ANEMIA)).toEqual({ column: 'distrito', level: 'district' })
    expect(placeColumn([column('x', 'category')])).toBeNull()
  })
})

describe('planWidgets', () => {
  it('sin lugar no hay ranking ni mapa de calor', () => {
    const plan = planWidgets(facts([EGRESOS[0]!, EGRESOS[2]!]), { kind: 'records' }, 'week')
    expect(plan.map((widget) => widget.type)).not.toContain('ranking')
    expect(plan.map((widget) => widget.type)).not.toContain('heatmap')
  })

  it('omite la serie con un solo periodo', () => {
    const plan = planWidgets(facts(EGRESOS, { periods: 1 }), { kind: 'records' }, 'day')
    expect(plan.map((widget) => widget.type)).not.toContain('timeseries')
    expect(plan.map((widget) => widget.type)).not.toContain('heatmap')
  })

  it('arma el tablero de un dataset de anemia sin fecha', () => {
    const plan = planWidgets(facts(ANEMIA), { kind: 'records' }, null)
    expect(plan.map((widget) => [widget.type, widget.column ?? null])).toEqual([
      ['kpis', null],
      ['ranking', 'distrito'],
      ['breakdown', 'sexo'],
      ['breakdown', 'anemia'],
      ['histogram', 'hemoglobina'],
    ])
  })

  it('títulos en español con el nombre de la columna', () => {
    const plan = planWidgets(facts(EGRESOS, { years: 2 }), { kind: 'mean', column: 'edad' }, 'week')
    expect(plan.map((widget) => widget.title)).toEqual([
      'Indicadores clave',
      'Edad promedio por semana',
      'Edad promedio: comparación entre años',
      'Edad promedio por departamento',
      'Edad promedio por departamento y semana',
      'Edad promedio por sexo',
      'Distribución de edad',
    ])
  })

  it('no arma mapa de calor con más de 40 lugares', () => {
    const plan = planWidgets(facts(EGRESOS, { places: 41 }), { kind: 'records' }, 'week')
    expect(plan.map((widget) => widget.type)).toContain('ranking')
    expect(plan.map((widget) => widget.type)).not.toContain('heatmap')
  })
})

describe('topWithOthers', () => {
  const rows = Array.from({ length: 13 }, (_, index) => ({
    name: `D${index + 1}`,
    value: 13 - index,
    count: 2,
  }))

  it('agrupa en Otros pasadas 10 barras', () => {
    const result = topWithOthers(rows, { kind: 'records' })
    expect(result).toHaveLength(11)
    expect(result.at(-1)).toEqual({ name: 'Otros', value: 3 + 2 + 1 })
  })

  it('no mezcla una categoría real llamada Otros con el grupo del resto', () => {
    const withOthers = [{ name: 'Otros', value: 50, count: 1 }, ...rows]
    const result = topWithOthers(withOthers, { kind: 'records' })
    expect(result[0]).toEqual({ name: 'Otros', value: 50 })
    expect(result.at(-1)?.name).toBe('Resto')
  })

  it('promedia Otros ponderando por la cantidad de registros', () => {
    const result = topWithOthers(
      [...rows.slice(0, 10), { name: 'X', value: 1, count: 1 }, { name: 'Y', value: 2, count: 3 }],
      { kind: 'mean', column: 'edad' },
    )
    expect(result.at(-1)).toEqual({ name: 'Otros', value: 1.75 })
  })
})

describe('category priority', () => {
  it('prioriza las categorías con pocos valores sobre las de muchos', () => {
    const columns = Array.from({ length: 8 }, (_, index) => column(`c${index}`, 'category'))
    const distinct = Object.fromEntries(
      columns.map((item, index) => [item.name, index === 0 ? 300 : index + 1]),
    )
    const plan = planWidgets(
      { columns, rows: 500, periods: 0, places: 0, years: 0, distinct },
      { kind: 'records' },
      null,
    )
    const breakdowns = plan
      .filter((widget) => widget.type === 'breakdown')
      .map((widget) => widget.column)
    expect(breakdowns).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'])
  })
})
