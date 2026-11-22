import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AnomalyRowSchema,
  HeatmapResponseSchema,
  InterannualRowSchema,
  RankingRowSchema,
  WeeklySeriesRowSchema,
  type WeeklySeriesRow,
} from '@vigia/contracts'
import { describe, expect, it } from 'vitest'

import { buildAnomalies, buildHeatmap, buildInterannual, buildRanking, median } from './analysis'

// Lee y parsea un snapshot JSON de test/snapshots
function snapshot(name: string): unknown {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'test', 'snapshots', name), 'utf8'),
  ) as unknown
}

// Carga un snapshot como serie semanal validada
function weekly(name: string): WeeklySeriesRow[] {
  return WeeklySeriesRowSchema.array().parse(snapshot(name)) as WeeklySeriesRow[]
}

describe('analysis parity with the frozen fixtures', () => {
  it('matches the synthetic weekly fixture', () => {
    const rows = weekly('analysis_synthetic_weekly_series.json')

    expect(buildInterannual(rows, 'department')).toEqual(
      snapshot('analysis_synthetic_interannual.json'),
    )
    expect(buildHeatmap(rows, 2024, 'department')).toEqual(
      snapshot('analysis_synthetic_heatmap_2024.json'),
    )
    expect(buildAnomalies(rows, 'department')).toEqual(
      snapshot('analysis_synthetic_anomalies.json'),
    )
  })

  it('matches every demo analysis snapshot', () => {
    const rows = weekly('api_series.json')

    expect(buildInterannual(rows, 'department')).toEqual(snapshot('api_interannual.json'))
    expect(buildHeatmap(rows, 2024, 'department')).toEqual(snapshot('api_heatmap_2024.json'))
    expect(buildRanking(rows, 'department', 2024)).toEqual(snapshot('api_ranking_2024.json'))
    expect(buildAnomalies(rows, 'department')).toEqual(snapshot('api_anomalies.json'))
  })

  it('parses every published analysis shape', () => {
    expect(() => InterannualRowSchema.array().parse(snapshot('api_interannual.json'))).not.toThrow()
    expect(() => HeatmapResponseSchema.parse(snapshot('api_heatmap_2024.json'))).not.toThrow()
    expect(() => RankingRowSchema.array().parse(snapshot('api_ranking_2024.json'))).not.toThrow()
    expect(() => AnomalyRowSchema.array().parse(snapshot('api_anomalies.json'))).not.toThrow()
  })
})

describe('analysis rules', () => {
  const rows = weekly('analysis_synthetic_weekly_series.json')

  it('keeps the legacy province labels and values', () => {
    const provinceRows: WeeklySeriesRow[] = []
    const add = (province: string, year: number, week: number, cases: number): void => {
      provinceRows.push({
        department: province === 'SULLANA' ? 'PIURA' : province,
        province,
        year,
        epi_week: week,
        cases,
      })
    }
    for (const year of [2022, 2023, 2024]) {
      add('LIMA', year, 1, year === 2022 ? 5 : year === 2023 ? 6 : 7)
      add('LIMA', year, 2, year === 2022 ? 10 : year === 2023 ? 11 : 12)
      add('LIMA', year, 3, year === 2022 ? 15 : year === 2023 ? 16 : 50)
      for (const week of [1, 2, 3]) {
        add('PIURA', year, week, 20)
        add('SULLANA', year, week, 2)
      }
    }

    expect(buildHeatmap(provinceRows, 2024, 'province')).toEqual({
      geographies: ["('LIMA', 'LIMA')", "('PIURA', 'PIURA')", "('PIURA', 'SULLANA')"],
      weeks: [1, 2, 3],
      values: [
        [7, 12, 50],
        [20, 20, 20],
        [2, 2, 2],
      ],
    })
    expect(buildInterannual(provinceRows, 'province', 'sullana')).toEqual([
      { epi_week: 1, '2022': 2, '2023': 2, '2024': 2 },
      { epi_week: 2, '2022': 2, '2023': 2, '2024': 2 },
      { epi_week: 3, '2022': 2, '2023': 2, '2024': 2 },
    ])
    expect(buildRanking(provinceRows, 'province', 2024)).toEqual([
      { rank: 1, department: 'LIMA', province: 'LIMA', cases: 69 },
      { rank: 2, department: 'PIURA', province: 'PIURA', cases: 60 },
      { rank: 3, department: 'PIURA', province: 'SULLANA', cases: 6 },
    ])
  })

  it('filters a single department before pivoting', () => {
    expect(buildInterannual(rows, 'department', 'lima')).toEqual([
      { epi_week: 1, '2022': 5, '2023': 6, '2024': 7 },
      { epi_week: 2, '2022': 10, '2023': 11, '2024': 12 },
      { epi_week: 3, '2022': 15, '2023': 16, '2024': 50 },
    ])
    expect(buildInterannual(rows, 'department', 'unknown')).toEqual([])
  })

  it('uses pandas median semantics for even samples', () => {
    expect(median([1])).toBe(1)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNaN()
  })

  it('does not flag a geography with zero dispersion', () => {
    const flat: WeeklySeriesRow[] = [
      { department: 'LIMA', year: 2022, epi_week: 1, cases: 1 },
      { department: 'LIMA', year: 2023, epi_week: 1, cases: 1 },
      { department: 'LIMA', year: 2024, epi_week: 1, cases: 1 },
    ]
    expect(buildAnomalies(flat, 'department')).toEqual([
      {
        department: 'LIMA',
        year: 2022,
        epi_week: 1,
        cases: 1,
        seasonal_baseline: 1,
        residual: 0,
        robust_z: 0,
        is_anomaly: false,
      },
      {
        department: 'LIMA',
        year: 2023,
        epi_week: 1,
        cases: 1,
        seasonal_baseline: 1,
        residual: 0,
        robust_z: 0,
        is_anomaly: false,
      },
      {
        department: 'LIMA',
        year: 2024,
        epi_week: 1,
        cases: 1,
        seasonal_baseline: 1,
        residual: 0,
        robust_z: 0,
        is_anomaly: false,
      },
    ])
  })
})
