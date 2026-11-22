import { describe, expect, it } from 'vitest'

import {
  buildOutlook,
  confidenceFor,
  projectAnnual,
  type AnnualPoint,
  type OutlookSeriesRow,
} from './outlook'

// Genera filas semanales de un departamento y año con casos calculados por semana
function weeks(
  department: string,
  year: number,
  count: number,
  cases: (week: number) => number,
): OutlookSeriesRow[] {
  return Array.from({ length: count }, (_, index) => ({
    department,
    year,
    epi_week: index + 1,
    cases: cases(index + 1),
  }))
}

// Crea puntos anuales completos consecutivos desde 2022
const points = (...values: number[]): AnnualPoint[] =>
  values.map((cases, index) => ({ year: 2022 + index, cases, estimated: false }))

describe('projectAnnual', () => {
  it('projects five years after the last one', () => {
    const { projection } = projectAnnual(points(100, 110, 120), 5)
    expect(projection.map((row) => row.year)).toEqual([2025, 2026, 2027, 2028, 2029])
  })

  it('damps the trend so growth slows every year', () => {
    const { projection, annual_change_pct } = projectAnnual(points(100, 110, 120), 5)
    const steps = projection.map((row, index) => row.p50 - (projection[index - 1]?.p50 ?? 120))
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index]).toBeLessThanOrEqual(steps[index - 1] ?? 0)
    }
    expect(annual_change_pct).toBe(6)
  })

  it('caps a steep trend at 25 % of the last year', () => {
    const { projection } = projectAnnual(points(30_000, 12_000, 10_000), 5)
    expect(projection[0]?.p50).toBe(8250)
    expect(projection.every((row) => row.p50 > 0)).toBe(true)
  })

  it('widens the range with the horizon and with past variability', () => {
    const calm = projectAnnual(points(100, 102, 101), 5).projection
    const outbreak = projectAnnual(points(300, 100, 100), 5).projection
    const width = (row?: { p10: number; p90: number; p50: number }) =>
      row ? (row.p90 - row.p10) / row.p50 : 0
    expect(width(calm[4])).toBeGreaterThan(width(calm[0]))
    expect(width(outbreak[0])).toBeGreaterThan(width(calm[0]))
  })

  it('stays flat with a single year and reports no trend', () => {
    const result = projectAnnual(points(500), 3)
    expect(result.projection.map((row) => row.p50)).toEqual([500, 500, 500])
    expect(result.annual_change_pct).toBeNull()
  })

  it('returns nothing without history', () => {
    expect(projectAnnual([], 5)).toEqual({ history: [], projection: [], annual_change_pct: null })
  })
})

describe('buildOutlook', () => {
  it('estimates incomplete years from the seasonal shape of complete ones', () => {
    const rows = [
      ...weeks('LIMA', 2024, 52, (week) => (week <= 26 ? 10 : 30)),
      ...weeks('LIMA', 2025, 26, () => 20),
    ]
    const outlook = buildOutlook(rows)
    expect(outlook.total.history).toEqual([
      { year: 2024, cases: 1040, estimated: false },
      { year: 2025, cases: 2080, estimated: true },
    ])
    expect(outlook.complete_years).toBe(1)
    expect(outlook.estimated_years).toBe(1)
    expect(outlook.total.projection[0]?.year).toBe(2026)
  })

  it('skips incomplete years with too few usable weeks', () => {
    const rows = [...weeks('LIMA', 2024, 52, () => 10), ...weeks('LIMA', 2025, 10, () => 10)]
    expect(buildOutlook(rows).total.history.map((point) => point.year)).toEqual([2024])
  })

  it('needs at least one complete year', () => {
    const outlook = buildOutlook(weeks('LIMA', 2025, 30, () => 10))
    expect(outlook.total.projection).toEqual([])
  })

  it('projects every department, largest first', () => {
    const rows = [...weeks('PIURA', 2024, 52, () => 2), ...weeks('LIMA', 2024, 52, () => 20)]
    expect(buildOutlook(rows).departments.map((row) => row.department)).toEqual(['LIMA', 'PIURA'])
  })

  it('maps complete years to a confidence label', () => {
    expect(confidenceFor(1)).toBe('baja')
    expect(confidenceFor(5)).toBe('media')
    expect(confidenceFor(8)).toBe('alta')
  })
})
