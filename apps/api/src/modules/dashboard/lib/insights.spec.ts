import type { WidgetDto } from '@vigia/contracts'
import { describe, expect, it } from 'vitest'

import { findInsights, periodText } from './insights'

const RECORDS = { kind: 'records' } as const

// Serie semanal de prueba a partir de una lista de valores
function weekly(values: number[]): WidgetDto {
  return {
    type: 'timeseries',
    id: 'timeseries',
    title: 'Registros por semana',
    points: values.map((value, index) => ({
      period: `2026-S${String(index + 1).padStart(2, '0')}`,
      value,
    })),
  }
}

describe('periodText', () => {
  it('traduce semanas, meses, días y años', () => {
    expect(periodText('2027-S05')).toBe('la semana 5 de 2027')
    expect(periodText('2027-03')).toBe('marzo de 2027')
    expect(periodText('2027-03-14')).toBe('el 14 de marzo de 2027')
    expect(periodText('2027')).toBe('2027')
  })
})

describe('findInsights', () => {
  it('detecta una subida y el pico de la serie', () => {
    const insights = findInsights([weekly([5, 5, 5, 5, 8, 9, 10, 12])], RECORDS, 'Registros')
    expect(insights[0]).toEqual({
      kind: 'trend',
      tone: 'up',
      text: 'El número de registros sube 95 % en las últimas 4 semanas frente a las 4 anteriores.',
    })
    expect(insights[1]?.text).toBe('El valor más alto fue en la semana 8 de 2026, con 12.')
  })

  it('concuerda con un total y con un promedio', () => {
    const series = weekly([10, 10, 10, 10, 20, 20, 20, 20])
    expect(
      findInsights([series], { kind: 'sum', column: 'casos' }, 'Total de casos')[0]?.text,
    ).toBe('El total de casos sube 100 % en las últimas 4 semanas frente a las 4 anteriores.')
    expect(
      findInsights([series], { kind: 'mean', column: 'hb' }, 'Hemoglobina promedio')[0]?.text,
    ).toBe('Hemoglobina promedio sube 100 % en las últimas 4 semanas frente a las 4 anteriores.')
  })

  it('usa "veces" cuando el valor se duplica o más', () => {
    expect(findInsights([weekly([2, 2, 2, 2, 7, 7, 7, 7])], RECORDS, 'Registros')[0]?.text).toBe(
      'El número de registros se multiplica por 3.5 en las últimas 4 semanas frente a las 4 anteriores.',
    )
    const widget: WidgetDto = {
      type: 'interannual',
      id: 'interannual',
      title: 'x',
      years: ['2026', '2027'],
      rows: [
        { index: 1, '2026': 2, '2027': 26 },
        { index: 2, '2026': 2, '2027': 26 },
      ],
    }
    expect(findInsights([widget], RECORDS, 'Registros')[0]?.text).toBe(
      'En 2027 van 52, 13 veces lo del mismo periodo de 2026.',
    )
  })

  it('dice que está estable si el cambio es chico', () => {
    const [trend] = findInsights([weekly([10, 10, 10, 10, 11, 10, 9, 10])], RECORDS, 'Casos')
    expect(trend).toMatchObject({ tone: 'neutral', text: expect.stringContaining('estable') })
  })

  it('compara con el año anterior en los mismos periodos', () => {
    const widget: WidgetDto = {
      type: 'interannual',
      id: 'interannual',
      title: 'Casos: comparación entre años',
      years: ['2025', '2026'],
      rows: [
        { index: 1, '2025': 10, '2026': 15 },
        { index: 2, '2025': 10, '2026': 15 },
        { index: 3, '2025': 10, '2026': null },
      ],
    }
    expect(findInsights([widget], RECORDS, 'Casos')).toEqual([
      {
        kind: 'comparison',
        tone: 'up',
        text: 'En 2026 van 30, 50 % más que en el mismo periodo de 2025.',
      },
    ])
  })

  it('señala la concentración por lugar y la categoría dominante', () => {
    const widgets: WidgetDto[] = [
      {
        type: 'ranking',
        id: 'ranking',
        title: 'Casos por departamento',
        rows: [
          { name: 'LORETO', value: 60 },
          { name: 'PIURA', value: 30 },
          { name: 'LIMA', value: 10 },
        ],
      },
      {
        type: 'breakdown',
        id: 'breakdown:sexo',
        title: 'Casos por sexo',
        rows: [
          { name: 'F', value: 70 },
          { name: 'M', value: 30 },
        ],
      },
    ]
    expect(findInsights(widgets, RECORDS, 'Casos').map((insight) => insight.text)).toEqual([
      'LORETO concentra el 60 % de los registros.',
      'En sexo, predomina F con el 70 %.',
    ])
  })

  it('con un promedio no suma lugares ni categorías', () => {
    const widgets: WidgetDto[] = [
      {
        type: 'ranking',
        id: 'ranking',
        title: 'x',
        rows: [
          { name: 'A', value: 9 },
          { name: 'B', value: 1 },
        ],
      },
    ]
    expect(findInsights(widgets, { kind: 'mean', column: 'hb' }, 'Hemoglobina')).toEqual([])
  })

  it('no inventa hallazgos sin datos', () => {
    expect(findInsights([weekly([0, 0, 0, 0])], RECORDS, 'Registros')).toEqual([])
    expect(findInsights([], RECORDS, 'Registros')).toEqual([])
  })
})
