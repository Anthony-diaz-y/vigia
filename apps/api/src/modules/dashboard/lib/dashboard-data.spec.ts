import { describe, expect, it } from 'vitest'

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
