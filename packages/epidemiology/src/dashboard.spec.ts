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

describe('códigos de lugar', () => {
  const PROVINCIA = column('cod_prov', 'category', { label: 'Código de provincia' })
  const NOMBRE = column('nom_dist', 'place', { level: 'district', label: 'Distrito' })
  const widgets = (columns: DatasetColumn[], distinct: Record<string, number>) =>
    planWidgets(facts(columns, { distinct }), { kind: 'records' }, 'month')

  it('no arma desgloses por códigos si ya hay un lugar', () => {
    const plan = widgets([NOMBRE, PROVINCIA, column('sexo', 'category')], {
      cod_prov: 7,
      sexo: 2,
    })
    const ids = plan.filter((widget) => widget.type === 'breakdown').map((widget) => widget.id)
    expect(ids).toEqual(['breakdown:sexo'])
  })

  it('sin lugar, desglosa el código con el nombre del nivel en el título', () => {
    const plan = widgets([PROVINCIA, column('cod_dist', 'category', { label: 'Código' })], {
      cod_prov: 7,
      cod_dist: 30,
    })
    const titles = plan
      .filter((widget) => widget.type === 'breakdown')
      .map((widget) => widget.title)
    expect(titles).toEqual(['Registros por provincia', 'Registros por distrito'])
  })

  it('prefiere categorías con nombre antes que las que son códigos', () => {
    const plan = widgets(
      [column('cod_red', 'category', { label: 'Código de red' }), column('sexo', 'category')],
      { cod_red: 2, sexo: 5 },
    )
    const ids = plan.filter((widget) => widget.type === 'breakdown').map((widget) => widget.id)
    expect(ids).toEqual(['breakdown:sexo', 'breakdown:cod_red'])
  })

  it('el título del lugar nunca dice "código"', () => {
    const plan = widgets([column('ubigeo', 'place', { level: 'ubigeo' })], {})
    const ranking = plan.find((widget) => widget.type === 'ranking')
    expect(ranking?.title).toBe('Registros por ubicación')
  })
})

describe('lugar principal con varios niveles', () => {
  const DEPARTAMENTO = column('cod_dep', 'place', { level: 'department', label: 'Departamento' })
  const PROVINCIA = column('cod_prov', 'place', { level: 'province', label: 'Provincia' })
  const DISTRITO = column('nom_dist', 'place', { level: 'district', label: 'Distrito' })
  const COLUMNS = [DEPARTAMENTO, PROVINCIA, DISTRITO, column('sexo', 'category')]
  const distinct = { cod_dep: 1, cod_prov: 7, nom_dist: 40, sexo: 2 }

  it('usa el nivel más alto con al menos 2 valores distintos', () => {
    expect(placeColumn(COLUMNS, distinct)).toEqual({ column: 'cod_prov', level: 'province' })
    expect(placeColumn(COLUMNS, { ...distinct, cod_dep: 3 })).toEqual({
      column: 'cod_dep',
      level: 'department',
    })
  })

  it('si todos los niveles son constantes conserva la elección de siempre', () => {
    const constant = { cod_dep: 1, cod_prov: 1, nom_dist: 1 }
    expect(placeColumn(COLUMNS, constant)).toEqual({ column: 'cod_dep', level: 'department' })
  })

  it('con un departamento constante arma el ranking por provincia y desglosa el distrito', () => {
    const plan = planWidgets(facts(COLUMNS, { distinct, places: 7 }), { kind: 'records' }, 'month')
    expect(plan.find((widget) => widget.type === 'ranking')).toMatchObject({
      column: 'cod_prov',
      title: 'Registros por provincia',
    })
    expect(plan.find((widget) => widget.type === 'heatmap')?.column).toBe('cod_prov')
    const breakdowns = plan.filter((widget) => widget.type === 'breakdown')
    expect(breakdowns.map((widget) => [widget.id, widget.title])).toEqual([
      ['breakdown:nom_dist', 'Registros por distrito'],
      ['breakdown:sexo', 'Registros por sexo'],
    ])
    expect(plan.some((widget) => widget.column === 'cod_dep')).toBe(false)
    expect(plan.some((widget) => /código/i.test(widget.title))).toBe(false)
  })
})

describe('planWidgets: categorías de poca información', () => {
  const columns = [
    column('priorizado', 'category', { label: 'Priorizado en 2024' }),
    column('estado', 'category', { label: 'Estado del establecimiento' }),
    column('tipo', 'category', { label: 'Tipo' }),
    column('edad_grupo', 'category'),
  ]
  const shapes = {
    priorizado: { values: 2, yesNo: true, topShare: 0.836, topMissing: false },
    estado: { values: 2, yesNo: false, topShare: 0.989, topMissing: false },
    tipo: { values: 4, yesNo: false, topShare: 0.93, topMissing: false },
    edad_grupo: { values: 4, yesNo: false, topShare: 0.5, topMissing: false },
  }
  const distinct = { priorizado: 2, estado: 3, tipo: 5, edad_grupo: 4 }

  // Planea un tablero con las formas de categoría dadas
  const plan = (categories: DatasetFacts['categories'], indicator = defaultIndicator(columns)) =>
    planWidgets(
      facts(columns, { distinct, categories, periods: 0, places: 0 }),
      indicator,
      null,
    ).filter((widget) => widget.type === 'breakdown')

  it('elige proporción para sí/no y para dos valores repartidos', () => {
    const widgets = plan(shapes)
    expect(widgets.find((widget) => widget.column === 'priorizado')).toMatchObject({
      variant: 'proportion',
      title: 'Priorizado en 2024',
    })
    expect(
      plan({ ...shapes, tipo: { values: 2, yesNo: false, topShare: 0.6, topMissing: false } }).find(
        (widget) => widget.column === 'tipo',
      ),
    ).toMatchObject({ variant: 'proportion', title: 'Tipo' })
  })

  it('elige dominante con pocos valores y un valor de 90 % o más', () => {
    const widgets = plan(shapes)
    expect(widgets.find((widget) => widget.column === 'estado')).toMatchObject({
      variant: 'dominant',
      title: 'Estado del establecimiento',
    })
    expect(widgets.find((widget) => widget.column === 'tipo')?.variant).toBe('dominant')
  })

  it('mantiene barras cuando hay variedad, muchos valores o el dominante es el sin dato', () => {
    const widgets = plan({
      ...shapes,
      tipo: { values: 6, yesNo: false, topShare: 0.95, topMissing: false },
      estado: { values: 3, yesNo: false, topShare: 0.95, topMissing: true },
    })
    expect(widgets.find((widget) => widget.column === 'edad_grupo')).toMatchObject({
      title: 'Registros por edad grupo',
    })
    expect(widgets.find((widget) => widget.column === 'edad_grupo')?.variant).toBeUndefined()
    expect(widgets.find((widget) => widget.column === 'tipo')?.variant).toBeUndefined()
    expect(widgets.find((widget) => widget.column === 'estado')?.variant).toBeUndefined()
  })

  it('sin formas, o con un promedio, todo sigue siendo barras con el título de siempre', () => {
    const plain = plan(undefined)
    expect(plain.every((widget) => widget.variant === undefined)).toBe(true)
    expect(plain.find((widget) => widget.column === 'priorizado')?.title).toBe(
      'Registros por priorizado en 2024',
    )
    const mean = plan(shapes, { kind: 'mean', column: 'hb' })
    expect(mean.every((widget) => widget.variant === undefined)).toBe(true)
  })

  it('el título de una proporción sin etiqueta usa el nombre legible de la columna', () => {
    const raw = [column('ESTABLECIMIENTO_PRIORIZADO_2024', 'category')]
    const [widget] = planWidgets(
      facts(raw, {
        distinct: { ESTABLECIMIENTO_PRIORIZADO_2024: 2 },
        categories: {
          ESTABLECIMIENTO_PRIORIZADO_2024: {
            values: 2,
            yesNo: true,
            topShare: 0.8,
            topMissing: false,
          },
        },
        periods: 0,
        places: 0,
      }),
      { kind: 'records' },
      null,
    ).filter((item) => item.type === 'breakdown')
    expect(widget?.title).toBe('Establecimiento priorizado 2024')
  })
})

describe('tope de gráficos con tarjetas compactas', () => {
  const plan = (columns: DatasetColumn[], facts: DatasetFacts) =>
    planWidgets(facts, { kind: 'records' }, null)
      .filter((widget) => widget.type === 'breakdown')
      .map((widget) => `${widget.column}:${widget.variant ?? 'bars'}`)

  it('las tarjetas compactas no gastan el tope de barras', () => {
    const bars = Array.from({ length: 6 }, (_, index) => column(`b${index}`, 'category'))
    const yesNo = Array.from({ length: 3 }, (_, index) => column(`s${index}`, 'category'))
    const columns = [...bars, ...yesNo]
    const categories = Object.fromEntries(
      yesNo.map((item) => [
        item.name,
        { values: 2, yesNo: true, topShare: 0.5, topMissing: false },
      ]),
    )
    const distinct = Object.fromEntries(columns.map((item) => [item.name, 4]))
    const ids = plan(columns, {
      columns,
      rows: 100,
      periods: 0,
      places: 0,
      years: 0,
      distinct,
      categories,
    })
    expect(ids.filter((id) => id.endsWith(':bars'))).toHaveLength(6)
    expect(ids.filter((id) => id.endsWith(':proportion'))).toHaveLength(3)
  })

  it('un código de ubicación no tiene gráfico propio si hay provincia y distrito con nombres', () => {
    const columns = [
      column('ubigeo', 'place', { level: 'ubigeo' }),
      column('provincia', 'place', { level: 'province' }),
      column('distrito', 'place', { level: 'district' }),
      column('nivel', 'category'),
      column('tipo', 'category'),
    ]
    const widgets = planWidgets(
      facts(columns, { distinct: { ubigeo: 79, provincia: 11, distrito: 79, nivel: 4, tipo: 5 } }),
      { kind: 'records' },
      null,
    )
    expect(widgets.map((widget) => widget.column ?? widget.id)).toEqual([
      'kpis',
      'provincia',
      'distrito',
      'nivel',
      'tipo',
    ])
  })

  it('con dos lugares y varias categorías, NIVEL y TIPO siguen teniendo gráfico', () => {
    const columns = [
      column('provincia', 'place', { level: 'province' }),
      column('distrito', 'place', { level: 'district' }),
      ...['nivel', 'tipo', 'categoria', 'red', 'ogess', 'institucion'].map((name) =>
        column(name, 'category'),
      ),
    ]
    const ids = plan(columns, {
      ...facts(columns),
      periods: 0,
      distinct: {
        provincia: 10,
        distrito: 70,
        nivel: 3,
        tipo: 5,
        categoria: 9,
        red: 12,
        ogess: 6,
        institucion: 11,
      },
    })
    expect(ids).toContain('nivel:bars')
    expect(ids).toContain('tipo:bars')
  })
})
