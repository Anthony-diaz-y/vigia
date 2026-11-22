import { describe, expect, it } from 'vitest'

import {
  ACTION_TABLE,
  DRIVER_LABELS,
  explainSeries,
  FEATURES,
  linearShap,
  narrativesFromDrivers,
  recommend,
  renderTemplate,
  ridgeWeights,
  standardize,
  topDrivers,
  type NarrativePayload,
} from './explain'
import type { WeeklyPoint } from './forecast'

// Genera series semanales sintéticas con tendencia, plana, ruidosa y corta
function buildSeries(): WeeklyPoint[] {
  const seasonal = Array.from({ length: 52 }, (_, index) => 20 + ((index * 3) % 10))
  const rows: WeeklyPoint[] = []

  const add = (
    department: string,
    years: readonly number[],
    trend: number,
    noise: (index: number) => number,
  ): void => {
    for (const year of years) {
      for (let week = 1; week <= 52; week += 1) {
        const index = (year - 2022) * 52 + (week - 1)
        rows.push({
          department,
          province: department,
          year,
          epi_week: week,
          cases: seasonal[week - 1]! + trend * index + noise(index),
        })
      }
    }
  }

  add('TREND', [2022, 2023, 2024], 2, () => 0)
  add('FLAT', [2022, 2023, 2024], 0, () => 0)
  add('NOISY', [2022, 2023, 2024], 3, (index) => ((index * 7) % 5) - 2)
  add('SHORT', [2022], 0, () => 0)
  return rows
}

describe('linear SHAP', () => {
  it('uses the closed-form formula', () => {
    expect(
      linearShap(
        [
          [1, -1],
          [2, 0.5],
        ],
        [0.5, -2],
      ),
    ).toEqual([
      [0.5, 2],
      [1, -1],
    ])
  })

  it('standardizes with population std and safe zero variance', () => {
    const { standardized, std } = standardize([
      [1, 5],
      [2, 5],
      [3, 5],
    ])
    expect(std[0]).toBeCloseTo(Math.sqrt(2 / 3), 12)
    expect(std[1]).toBe(1)
    expect(standardized.map((row) => row[1])).toEqual([0, 0, 0])
  })

  it('solves a small ridge system', () => {
    expect(ridgeWeights([[1]], [2], 0)).toEqual([2])
    expect(
      ridgeWeights(
        [
          [1, 0],
          [0, 1],
        ],
        [2, 3],
        0,
      ),
    ).toEqual([2, 3])
    expect(
      ridgeWeights(
        [
          [1, 0],
          [0, 1],
        ],
        [2, 3],
        1,
      ),
    ).toEqual([1, 1.5])
  })
})

describe('topDrivers', () => {
  it('returns the top five drivers per unit with history', () => {
    const drivers = topDrivers(buildSeries(), 'department')

    expect(new Set(drivers.map((row) => row.department))).toEqual(
      new Set(['TREND', 'FLAT', 'NOISY']),
    )
    for (const department of ['TREND', 'FLAT', 'NOISY']) {
      const group = drivers.filter((row) => row.department === department)
      expect(group.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5])
      expect(group.every((row) => (FEATURES as readonly string[]).includes(row.feature))).toBe(true)
      for (let index = 1; index < group.length; index += 1) {
        expect(group[index]!.abs_mean_shap).toBeLessThanOrEqual(group[index - 1]!.abs_mean_shap)
      }
    }
  })

  it('ranks the seasonal baseline first for a perfectly periodic unit', () => {
    const flat = topDrivers(buildSeries(), 'department').filter((row) => row.department === 'FLAT')
    expect(flat[0]?.feature).toBe('seasonal_baseline')
  })

  it('attaches a deterministic action to every feature', () => {
    for (const feature of FEATURES) {
      expect(DRIVER_LABELS[feature]).toBeTruthy()
      expect(ACTION_TABLE[feature]).toBeTruthy()
    }

    const recommendations = recommend(topDrivers(buildSeries(), 'department'))
    expect(recommendations.every((row) => row.action === ACTION_TABLE[row.feature])).toBe(true)
  })
})

describe('narratives', () => {
  it('renders the deterministic template', () => {
    const payload: NarrativePayload = {
      unit: 'LIMA',
      drivers: [
        {
          driver: 'Casos recientes',
          feature: 'recent_level',
          direction: 'up',
          mean_shap: 1,
          action: 'Intensificar la investigación de casos.',
        },
        {
          driver: 'Temporada previa',
          feature: 'seasonal_baseline',
          direction: 'down',
          mean_shap: -1,
          action: 'Preparar capacidad de respuesta.',
        },
      ],
    }
    const first = renderTemplate(payload)
    expect(renderTemplate(payload)).toBe(first)
    expect(first).toContain('LIMA')
    expect(first).toContain('Casos recientes (al alza)')
    expect(first).toContain('Intensificar la investigación de casos.')
  })

  it('builds one narrative per unit', () => {
    const result = explainSeries(buildSeries(), 'department')
    expect(new Set(result.drivers.map((row) => row.department))).toEqual(
      new Set(['TREND', 'FLAT', 'NOISY']),
    )
    expect(result.narratives).toHaveLength(3)
    expect(result.narratives.every((item) => item.source === 'template')).toBe(true)

    const texts = result.narratives.map((item) => item.text).join('\n')
    expect(texts).toContain('TREND')
    expect(texts).toContain('FLAT')
    expect(texts).toContain('NOISY')
  })

  it('is reproducible', () => {
    const first = explainSeries(buildSeries(), 'department')
    const second = explainSeries(buildSeries(), 'department')
    expect(first).toEqual(second)
  })

  it('tags each narrative with the geography it describes', () => {
    const result = explainSeries(buildSeries(), 'department')
    for (const narrative of result.narratives) {
      expect(narrative.province).toBeUndefined()
      expect(narrative.text).toContain(`Para ${narrative.department},`)
    }
    expect(result.narratives.map((item) => item.department).sort()).toEqual([
      'FLAT',
      'NOISY',
      'TREND',
    ])
  })

  it('does not emit narratives without drivers', () => {
    expect(narrativesFromDrivers([])).toEqual([])
  })
})
