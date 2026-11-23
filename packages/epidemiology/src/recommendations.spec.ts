import { describe, expect, it } from 'vitest'

import { ACTION_TABLE } from './explain'
import {
  alertLevel,
  buildRecommendations,
  GENERAL_LEVEL_ACTIONS,
  isDengueTopic,
  LEVEL_ACTIONS,
  percentChange,
  recommendationPayload,
  renderRecommendationSummary,
  type RecommendationInputs,
  type RecommendationSeriesRow,
} from './recommendations'

// Genera 20 semanas de 2024 de un departamento (1-14 consolidadas, 15-20 provisionales)
function series(department: string, casesForWeek: (week: number) => number) {
  const rows: RecommendationSeriesRow[] = []
  for (let week = 1; week <= 20; week += 1) {
    rows.push({ department, year: 2024, epi_week: week, cases: casesForWeek(week) })
  }
  return rows
}

// Arma entradas de prueba con departamentos en alza, estable y con pocos casos
function inputs(overrides: Partial<RecommendationInputs> = {}): RecommendationInputs {
  return {
    series: [
      ...series('PIURA', (week) => (week >= 11 ? 40 : 20)),
      ...series('LIMA', () => 50),
      ...series('AMAZONAS', () => 1),
    ],
    anomalies: [],
    scorecard: [],
    forecasts: [],
    drivers: [],
    ...overrides,
  }
}

describe('percentChange', () => {
  it('ignores changes on tiny counts', () => {
    expect(percentChange(2, 6)).toBeNull()
  })

  it('rounds the relative change', () => {
    expect(percentChange(80, 160)).toBe(100)
    expect(percentChange(200, 150)).toBe(-25)
  })

  it('treats growth from zero as 100 %', () => {
    expect(percentChange(0, 30)).toBe(100)
  })
})

describe('alertLevel', () => {
  it('raises a high alert on strong growth, a rising forecast or an anomaly with growth', () => {
    expect(alertLevel(50, null, 0)).toBe('alto')
    expect(alertLevel(0, 25, 0)).toBe('alto')
    expect(alertLevel(5, null, 1)).toBe('alto')
  })

  it('asks for attention on moderate growth or an isolated anomaly', () => {
    expect(alertLevel(10, null, 0)).toBe('medio')
    expect(alertLevel(-20, 12, 0)).toBe('medio')
    expect(alertLevel(-5, null, 2)).toBe('medio')
  })

  it('stays low otherwise', () => {
    expect(alertLevel(null, null, 0)).toBe('bajo')
    expect(alertLevel(-30, -10, 0)).toBe('bajo')
  })
})

describe('buildRecommendations', () => {
  it('compares the last consolidated weeks, skipping provisional ones', () => {
    const report = buildRecommendations(inputs())
    expect(report.window).toEqual({
      from: { year: 2024, epi_week: 11 },
      to: { year: 2024, epi_week: 14 },
    })
    const piura = report.items.find((item) => item.department === 'PIURA')
    expect(piura).toMatchObject({
      level: 'alto',
      recent_cases: 160,
      previous_cases: 80,
      change_pct: 100,
    })
    expect(piura?.reasons[0]).toBe('Casos en alza: 80 → 160 (+100 %).')
  })

  it('sorts by alert level and counts each level', () => {
    const report = buildRecommendations(inputs())
    expect(report.items.map((item) => item.level)).toEqual(['alto', 'bajo', 'bajo'])
    expect(report.items[0]?.department).toBe('PIURA')
    expect(report.counts).toEqual({ alto: 1, medio: 0, bajo: 2 })
    expect(report.overall_level).toBe('alto')
  })

  it('uses the forecast only when it passed the publication gate', () => {
    const forecasts = [1, 2, 3, 4].map((horizon) => ({ department: 'LIMA', horizon, p50: 70 }))
    const gated = buildRecommendations(
      inputs({ forecasts, scorecard: [{ department: 'LIMA', status: 'insufficient_evidence' }] }),
    )
    const gatedLima = gated.items.find((item) => item.department === 'LIMA')
    expect(gatedLima?.forecast_cases).toBeNull()
    expect(gatedLima?.reasons).toContain('Sin pronóstico confiable para este departamento.')

    const published = buildRecommendations(
      inputs({ forecasts, scorecard: [{ department: 'LIMA', status: 'publish' }] }),
    )
    const lima = published.items.find((item) => item.department === 'LIMA')
    expect(lima).toMatchObject({ forecast_cases: 280, forecast_change_pct: 40, level: 'alto' })
  })

  it('counts only anomalies inside the recent lookback', () => {
    const report = buildRecommendations(
      inputs({
        anomalies: [
          { department: 'LIMA', year: 2024, epi_week: 2, is_anomaly: true },
          { department: 'LIMA', year: 2024, epi_week: 18, is_anomaly: true },
          { department: 'LIMA', year: 2024, epi_week: 19, is_anomaly: false },
        ],
      }),
    )
    const lima = report.items.find((item) => item.department === 'LIMA')
    expect(lima?.recent_anomalies).toBe(1)
    expect(lima?.level).toBe('medio')
  })

  it('takes at most two actions from the fixed tables, never free text', () => {
    const report = buildRecommendations(
      inputs({
        drivers: [
          { department: 'PIURA', rank: 2, feature: 'recent_level', direction: 'up' },
          { department: 'PIURA', rank: 1, feature: 'year_over_year_trend', direction: 'up' },
        ],
      }),
    )
    const piura = report.items.find((item) => item.department === 'PIURA')
    expect(piura?.actions).toEqual([LEVEL_ACTIONS.alto[0], ACTION_TABLE.year_over_year_trend])
    const lima = report.items.find((item) => item.department === 'LIMA')
    expect(lima?.actions).toEqual([...LEVEL_ACTIONS.bajo])
  })
})

describe('summary and payload', () => {
  it('renders a deterministic headline naming the priorities', () => {
    const summary = renderRecommendationSummary(buildRecommendations(inputs()))
    expect(summary.headline).toBe('Actuar esta semana en PIURA')
    expect(summary.text).toBe('Primer paso en PIURA: activar la sala situacional esta semana.')
    expect(renderRecommendationSummary(buildRecommendations(inputs()), 12).text).toContain(
      'A 5 años, los casos anuales crecen ~12 % por año.',
    )
  })

  it('sends only aggregated text to the narrative writer', () => {
    const payload = recommendationPayload(buildRecommendations(inputs()), -5)
    expect(payload.five_year_trend).toBe('los casos anuales bajan ~5 % por año')
    expect(Object.keys(payload.departments[0] ?? {})).toEqual([
      'department',
      'level',
      'reasons',
      'first_action',
    ])
  })
})

describe('recommendations adapted to any indicator', () => {
  const HEMOGLOBIN = {
    indicatorLabel: 'Hemoglobina promedio',
    aggregate: 'mean',
    direction: 'both',
    actions: 'general',
  } as const

  // Serie de promedios: Junín cae de 11.5 a 9.2 en las 4 semanas consolidadas más recientes
  function averages(): RecommendationInputs {
    return inputs({
      series: [
        ...series('JUNIN', (week) => (week >= 11 && week <= 14 ? 9.2 : 11.5)),
        ...series('PIURA', () => 11.4),
      ],
    })
  }

  it('con direction both una caída del 20 % es alerta', () => {
    const report = buildRecommendations(averages(), HEMOGLOBIN)
    const junin = report.items.find((item) => item.department === 'JUNIN')
    expect(junin?.level).toBe('medio')
    expect(junin?.change_pct).toBe(-20)
    expect(report.items.find((item) => item.department === 'PIURA')?.level).toBe('bajo')
  })

  it('motivos usan el nombre del indicador y promedios con un decimal', () => {
    const junin = buildRecommendations(averages(), HEMOGLOBIN).items.find(
      (item) => item.department === 'JUNIN',
    )
    expect(junin?.recent_cases).toBe(9.2)
    expect(junin?.reasons[0]).toBe('Hemoglobina promedio a la baja: 11.5 → 9.2 (-20 %).')
  })

  it('tabla general no menciona criaderos ni vectores', () => {
    const junin = buildRecommendations(averages(), HEMOGLOBIN).items.find(
      (item) => item.department === 'JUNIN',
    )
    expect(junin?.actions.length).toBeGreaterThan(0)
    for (const action of [...Object.values(GENERAL_LEVEL_ACTIONS).flat(), ...junin!.actions]) {
      expect(action).not.toMatch(/criadero|larvario|vector|transmisión/i)
    }
  })

  it('los valores por defecto conservan los textos del dengue', () => {
    const report = buildRecommendations(inputs())
    expect(report.items.find((item) => item.department === 'PIURA')?.reasons[0]).toBe(
      'Casos en alza: 80 → 160 (+100 %).',
    )
  })

  it('isDengueTopic reconoce el tema dengue', () => {
    expect(isDengueTopic('Dengue 2024')).toBe(true)
    expect(isDengueTopic('vigilancia del DENGUE')).toBe(true)
    expect(isDengueTopic('anemia')).toBe(false)
    expect(isDengueTopic('')).toBe(false)
  })
})

describe('mean indicators with a published forecast', () => {
  it('compara el pronóstico como promedio, no como suma de 4 semanas', () => {
    const report = buildRecommendations(
      inputs({
        series: series('JUNIN', () => 11.2),
        scorecard: [{ department: 'JUNIN', status: 'publish' }],
        forecasts: [1, 2, 3, 4].map((horizon) => ({ department: 'JUNIN', horizon, p50: 11.1 })),
      }),
      {
        indicatorLabel: 'Hemoglobina promedio',
        aggregate: 'mean',
        direction: 'both',
        actions: 'general',
      },
    )
    const junin = report.items[0]
    expect(junin?.forecast_cases).toBe(11.1)
    expect(junin?.forecast_change_pct).toBe(-1)
    expect(junin?.level).toBe('bajo')
  })
})
