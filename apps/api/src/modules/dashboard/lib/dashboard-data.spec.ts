import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ingestUpload, previewUpload } from '../../ingestion/lib/ingest'
import { buildDashboard, epiYearOf, periodRange, weeklyIndicatorRows } from './dashboard-data'

describe('periodRange', () => {
  it('completa los meses sin datos entre el primero y el último', () => {
    expect(periodRange('2023-11', '2024-02', 'month')).toEqual([
      '2023-11',
      '2023-12',
      '2024-01',
      '2024-02',
    ])
  })

  it('completa días y años', () => {
    expect(periodRange('2026-02-27', '2026-03-02', 'day')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
    expect(periodRange('2022', '2024', 'year')).toEqual(['2022', '2023', '2024'])
  })

  it('completa semanas epidemiológicas respetando los años de 53 semanas', () => {
    expect(periodRange('2020-S52', '2021-S02', 'week')).toEqual([
      '2020-S52',
      '2020-S53',
      '2021-S01',
      '2021-S02',
    ])
    expect(periodRange('2023-S52', '2024-S01', 'week')).toEqual(['2023-S52', '2024-S01'])
  })
})

describe('weeklyIndicatorRows', () => {
  it('omite las semanas sin valores medidos en vez de contarlas como 0', () => {
    const columns = [
      { name: 'fecha', label: '', role: 'date', level: null, field: null, kind: 'date' },
      { name: 'hb', label: '', role: 'measure', level: null, field: null, kind: 'number' },
    ] as const
    const rows = [
      { fecha: '2026-01-05', hb: 11 },
      { fecha: '2026-01-12', hb: null },
    ]
    expect(
      weeklyIndicatorRows([...columns], rows, { kind: 'mean', column: 'hb' }, 'department'),
    ).toEqual([{ department: 'Total', year: 2026, epi_week: 1, cases: 11 }])
  })
})

describe('histogramas', () => {
  it('omite el histograma cuando casi todo cae en un solo intervalo', () => {
    const columns = [
      { name: 'codigo', label: '', role: 'measure', level: null, field: null, kind: 'number' },
      { name: 'edad', label: '', role: 'measure', level: null, field: null, kind: 'number' },
    ] as const
    const rows = Array.from({ length: 100 }, (_, index) => ({
      codigo: index === 0 ? 999999 : 100 + (index % 7),
      edad: 20 + (index % 50),
    }))
    const body = buildDashboard({
      title: 't',
      topic: '',
      columns: [...columns],
      rows,
      indicator: { kind: 'records' },
      year: null,
    })
    const ids = body.widgets.map((widget) => widget.id)
    expect(ids).toContain('histogram:edad')
    expect(ids).not.toContain('histogram:codigo')
  })
})

describe('año epidemiológico', () => {
  it('con fechas semanales cuenta el 2 de enero de 2026 en el año 2025, igual que Análisis', () => {
    expect(epiYearOf('2026-01-02')).toBe(2025)
    expect(epiYearOf('2026-01-04')).toBe(2026)
    const columns = [
      { name: 'fecha', label: '', role: 'date', level: null, field: null, kind: 'date' },
    ] as const
    const rows = [
      { fecha: '2025-10-05' },
      { fecha: '2025-12-30' },
      { fecha: '2026-01-02' },
      { fecha: '2026-03-01' },
    ]
    const body = buildDashboard({
      title: 't',
      topic: '',
      columns: [...columns],
      rows,
      indicator: { kind: 'records' },
      year: 2025,
    })
    expect(body.granularity).toBe('week')
    expect(body.years).toEqual([2026, 2025])
    const kpis = body.widgets.find((widget) => widget.type === 'kpis')
    expect(kpis?.type === 'kpis' && kpis.items[0]?.value).toBe('3')
  })
})

describe('códigos UBIGEO', () => {
  const base = { title: 't', topic: '', indicator: { kind: 'records' } as const, year: null }
  const col = (name: string, role: string, extra: Record<string, unknown> = {}) =>
    ({ name, label: '', role, level: null, field: null, kind: 'text', ...extra }) as never
  const dates = ['2026-01-05', '2026-01-12', '2026-01-19']
  // Filas de ejemplo: una fecha por fila y el valor dado en la columna de lugar
  const rowsOf = (column: string, values: (string | number)[]) =>
    values.map((value, index) => ({ fecha: dates[index % dates.length]!, [column]: value }))

  it('muestra nombres de provincia en el ranking y el mapa de calor, y el código desconocido tal cual', () => {
    const body = buildDashboard({
      ...base,
      columns: [
        col('fecha', 'date', { kind: 'date' }),
        col('cod_prov', 'place', { level: 'province' }),
      ],
      rows: rowsOf('cod_prov', ['0302', '0302', '0301', 302, '9999', '9999']),
    })
    const ranking = body.widgets.find((widget) => widget.type === 'ranking')
    const heatmap = body.widgets.find((widget) => widget.type === 'heatmap')
    expect(ranking?.title).toBe('Registros por provincia')
    expect(ranking).toMatchObject({
      rows: [
        { name: 'ANDAHUAYLAS', value: 3 },
        { name: '9999', value: 2 },
        { name: 'ABANCAY', value: 1 },
      ],
    })
    expect(heatmap).toMatchObject({ rows: ['ANDAHUAYLAS', '9999', 'ABANCAY'] })
  })

  it('traduce códigos de distrito y agrega la provincia solo si el nombre se repite', () => {
    const body = buildDashboard({
      ...base,
      columns: [
        col('fecha', 'date', { kind: 'date' }),
        col('cod_dist', 'place', { level: 'district' }),
      ],
      rows: rowsOf('cod_dist', ['030213', '030213', '150101', '030101']),
    })
    const names = (
      body.widgets.find((widget) => widget.type === 'ranking') as never as {
        rows: { name: string }[]
      }
    ).rows.map((row) => row.name)
    expect(names).toEqual(['SAN JERONIMO, ANDAHUAYLAS', 'ABANCAY', 'LIMA'])
  })

  it('traduce un código de provincia que quedó como categoría', () => {
    const body = buildDashboard({
      ...base,
      columns: [
        col('fecha', 'date', { kind: 'date' }),
        col('cod_prov', 'category', { label: 'Código de provincia' }),
      ],
      rows: rowsOf('cod_prov', ['0302', '0302', '0301']),
    })
    const breakdown = body.widgets.find((widget) => widget.type === 'breakdown')
    expect(breakdown?.title).toBe('Registros por provincia')
    expect(breakdown).toMatchObject({
      rows: [
        { name: 'ANDAHUAYLAS', value: 2 },
        { name: 'ABANCAY', value: 1 },
      ],
    })
  })

  it('mantiene los nombres de lugar como siempre', () => {
    const body = buildDashboard({
      ...base,
      columns: [
        col('fecha', 'date', { kind: 'date' }),
        col('distrito', 'place', { level: 'district' }),
      ],
      rows: rowsOf('distrito', ['Ate', 'ate ', 'Ancón']),
    })
    expect(body.widgets.find((widget) => widget.type === 'ranking')).toMatchObject({
      rows: [
        { name: 'ATE', value: 2 },
        { name: 'ANCÓN', value: 1 },
      ],
    })
  })
})

describe('lugar principal con un departamento constante', () => {
  const col = (name: string, role: string, extra: Record<string, unknown> = {}) =>
    ({ name, label: '', role, level: null, field: null, kind: 'text', ...extra }) as never
  const provinces = ['0301', '0302', '0303', '0304', '0305', '0306', '0307']
  const districts = ['ABANCAY', 'CHACOCHE', 'TAMBURCO', 'ANDAHUAYLAS', 'TALAVERA', 'PACUCHA']
  const rows = Array.from({ length: 28 }, (_, index) => ({
    cod_dep: '03',
    cod_prov: provinces[index % provinces.length]!,
    nom_dist: districts[index % districts.length]!,
    casos: index + 1,
  }))
  const body = buildDashboard({
    title: 't',
    topic: '',
    indicator: { kind: 'sum', column: 'casos' },
    year: null,
    columns: [
      col('cod_dep', 'place', { level: 'department' }),
      col('cod_prov', 'place', { level: 'province' }),
      col('nom_dist', 'place', { level: 'district' }),
      col('casos', 'count', { kind: 'number' }),
    ],
    rows,
  })

  it('cuenta las provincias como lugares y las usa en el ranking con sus nombres', () => {
    const kpis = body.widgets.find((widget) => widget.type === 'kpis') as never as {
      items: { label: string; value: string }[]
    }
    expect(kpis.items.find((item) => item.label === 'Lugares')?.value).toBe('7')
    const ranking = body.widgets.find((widget) => widget.type === 'ranking') as never as {
      title: string
      rows: { name: string }[]
    }
    expect(ranking.title).toBe('Total de casos por provincia')
    const names = ranking.rows.map((row) => row.name)
    expect(names).toHaveLength(7)
    expect(names).toEqual(expect.arrayContaining(['ABANCAY', 'ANDAHUAYLAS']))
  })

  it('desglosa el distrito y no el departamento constante', () => {
    const titles = body.widgets.map((widget) => widget.title)
    expect(titles).toContain('Total de casos por distrito')
    expect(titles.some((title) => /departamento|código/i.test(title))).toBe(false)
    const district = body.widgets.find((widget) => widget.id === 'breakdown:nom_dist') as never as {
      rows: { name: string }[]
    }
    expect(district.rows.map((row) => row.name)).toContain('ABANCAY')
  })
})

describe('categorías de poca información (establecimientos de San Martín)', () => {
  const FILE = 'establecimientos_san_martin.csv'
  const LABELS: Record<string, string> = {
    ESTABLECIMIENTO_PRIORIZADO_2024: 'Priorizado en 2024',
    NOTIFICA: 'Notifica casos',
    ESTADO: 'Estado del establecimiento',
  }

  // Arma el tablero del archivo de ejemplo, con o sin el significado de ESTADO sugerido por la IA
  async function board(estadoValues?: Record<string, string>) {
    const data = Buffer.from(
      readFileSync(resolve(process.cwd(), 'test', 'fixtures', FILE), 'utf8').replaceAll(
        '\r\n',
        '\n',
      ),
    )
    const suggested = Object.keys(LABELS)
      .concat('NIVEL')
      .map((column) => ({
        column,
        label: LABELS[column] ?? 'Nivel de atención',
        role: 'category' as const,
        level: null,
        field: null,
        reason: null,
        ...(column === 'ESTADO' && estadoValues ? { values: estadoValues } : {}),
      }))
    const preview = await previewUpload({ data, filename: FILE, source: 'minsa_dengue' }, () =>
      Promise.resolve({ title: null, topic: null, columns: suggested }),
    )
    const columns = preview.columns.map(
      ({ samples: _s, codes: _c, reason: _r, ...column }) => column,
    )
    const result = await ingestUpload({ data, filename: FILE, source: 'minsa_dengue', columns })
    return buildDashboard({
      title: 't',
      topic: 'establecimientos',
      columns: result.columns,
      rows: result.genericRows,
      indicator: { kind: 'records' },
      year: null,
    })
  }

  const widget = (body: Awaited<ReturnType<typeof board>>, column: string) =>
    body.widgets.find((item) => item.id === `breakdown:${column}`)

  it('muestra el priorizado como proporción con Sí y No', async () => {
    const body = await board()
    expect(widget(body, 'ESTABLECIMIENTO_PRIORIZADO_2024')).toEqual({
      type: 'breakdown',
      id: 'breakdown:ESTABLECIMIENTO_PRIORIZADO_2024',
      title: 'Priorizado en 2024',
      variant: 'proportion',
      rows: [
        { name: 'No', value: 40 },
        { name: 'Sí', value: 10 },
      ],
    })
  })

  it('NOTIFICA es sí/no y el DESCONOCIDO queda como Sin dato al final', async () => {
    const notifica = widget(await board(), 'NOTIFICA')
    expect(notifica).toMatchObject({ variant: 'proportion', title: 'Notifica casos' })
    expect(notifica?.type === 'breakdown' && notifica.rows).toEqual([
      { name: 'Sí', value: 40 },
      { name: 'No', value: 9 },
      { name: 'Sin dato', value: 1 },
    ])
  })

  it('ESTADO es dominante, con las etiquetas y el Sin dato al final', async () => {
    const estado = widget(await board({ '1': 'Activo', '2': 'Inactivo' }), 'ESTADO')
    expect(estado).toEqual({
      type: 'breakdown',
      id: 'breakdown:ESTADO',
      title: 'Estado del establecimiento',
      variant: 'dominant',
      rows: [
        { name: '1', label: 'Activo', value: 45 },
        { name: '2', label: 'Inactivo', value: 4 },
        { name: 'Sin dato', value: 1 },
      ],
    })
  })

  it('sin etiquetas de la IA muestra el código tal cual y sigue ordenando el Sin dato al final', async () => {
    const estado = widget(await board(), 'ESTADO')
    expect(estado?.type === 'breakdown' && estado.rows).toEqual([
      { name: '1', value: 45 },
      { name: '2', value: 4 },
      { name: 'Sin dato', value: 1 },
    ])
  })

  it('el Sin dato no se mezcla con "Otros" cuando hay más de 10 valores', () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, index) => ({ tipo: `V${index}`, n: 1 })),
      { tipo: 'NA', n: 1 },
    ]
    const body = buildDashboard({
      title: 't',
      topic: '',
      indicator: { kind: 'records' },
      year: null,
      columns: [
        { name: 'tipo', label: '', role: 'category', level: null, field: null, kind: 'text' },
      ],
      rows,
    })
    const names = body.widgets.flatMap((item) =>
      item.type === 'breakdown' ? item.rows.map((row) => row.name) : [],
    )
    expect(names.at(-1)).toBe('Sin dato')
    expect(names.at(-2)).toBe('Otros')
    expect(body.widgets.some((item) => item.type === 'breakdown' && item.variant)).toBe(false)
  })
})

describe('tablero completo de establecimientos de San Martín (solo reglas)', () => {
  const FILE = 'establecimientos_san_martin.csv'

  // Arma el tablero con los roles sugeridos solo por reglas
  async function rulesBoard() {
    const data = Buffer.from(
      readFileSync(resolve(process.cwd(), 'test', 'fixtures', FILE), 'utf8').replaceAll(
        String.fromCharCode(13, 10),
        String.fromCharCode(10),
      ),
    )
    const preview = await previewUpload({ data, filename: FILE, source: 'minsa_dengue' })
    const columns = preview.columns.map(
      ({ samples: _s, codes: _c, reason: _r, ...column }) => column,
    )
    const result = await ingestUpload({ data, filename: FILE, source: 'minsa_dengue', columns })
    return buildDashboard({
      title: 't',
      topic: 'establecimientos',
      columns: result.columns,
      rows: result.genericRows,
      indicator: { kind: 'records' },
      year: null,
    })
  }

  it('NIVEL y TIPO tienen gráfico y las tarjetas compactas no ocupan sus lugares', async () => {
    const ids = (await rulesBoard()).widgets.map((item) => item.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'breakdown:NIVEL',
        'breakdown:TIPO',
        'breakdown:CATEGORIA',
        'breakdown:ESTADO',
        'breakdown:NOTIFICA',
        'breakdown:ESTABLECIMIENTO_PRIORIZADO_2024',
      ]),
    )
  })

  it('el ranking es por provincia, el distrito se desglosa y el UBIGEO no repite lugares', async () => {
    const body = await rulesBoard()
    const ids = body.widgets.map((item) => item.id)
    expect(body.widgets.find((item) => item.id === 'ranking')?.title).toBe(
      'Registros por provincia',
    )
    expect(ids).toContain('breakdown:DISTRITO')
    expect(ids.filter((id) => /UBIGEO|COD_|DEPARTAMENTO/.test(id))).toEqual([])
  })

  it('las constantes y los identificadores no tienen gráfico', async () => {
    const ids = (await rulesBoard()).widgets.map((item) => item.id).join(' ')
    for (const name of [
      'NOMBRE_DIRES',
      'FECHA_CORTE',
      'ID_REGISTRO',
      'CODIGO_ESTABLECIMIENTO',
      'RENAES',
      'RAZON_SOCIAL',
      'EESS',
    ]) {
      expect(ids).not.toContain(name)
    }
  })
})
