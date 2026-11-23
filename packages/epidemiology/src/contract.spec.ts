import { describe, expect, it } from 'vitest'

import {
  AGE_BANDS,
  CANONICAL_COLUMNS,
  KEY_COLUMNS,
  MAX_EPI_WEEK,
  MIN_EPI_WEEK,
  OPTIONAL_COLUMNS,
  QUALITY_ISSUE_CODES,
  SEX_VALUES,
  UBIGEO_LENGTH,
  UNKNOWN,
  advanceEpiWeek,
} from './contract'

const ADVANCE_TEST_CASES: Array<[number, number, number, [number, number]]> = [
  [2022, 1, 52, [2023, 1]],
  [2022, 52, 52, [2023, 52]],
  [2023, 26, 26, [2023, 52]],
  [2024, 52, 5, [2025, 5]],
]

describe('canonical contract', () => {
  it('keeps the frozen canonical column order', () => {
    expect(CANONICAL_COLUMNS).toEqual([
      'disease',
      'ubigeo',
      'year',
      'epi_week',
      'department',
      'province',
      'district',
      'directorate',
      'sex',
      'age_group',
      'age_type',
      'diagnosis',
      'diagnosis_type',
      'cases',
    ])
  })

  it('excludes cases from the natural key', () => {
    expect(KEY_COLUMNS).toEqual([
      'disease',
      'ubigeo',
      'year',
      'epi_week',
      'department',
      'province',
      'district',
      'directorate',
      'sex',
      'age_group',
      'age_type',
      'diagnosis',
      'diagnosis_type',
    ])
    expect(KEY_COLUMNS).not.toContain('cases')
  })

  it('marks only descriptive columns as optional', () => {
    expect([...OPTIONAL_COLUMNS].sort()).toEqual([
      'age_group',
      'age_type',
      'department',
      'diagnosis',
      'diagnosis_type',
      'directorate',
      'district',
      'province',
      'sex',
    ])
  })

  it('defines contiguous age bands and normalized sex values', () => {
    expect(AGE_BANDS[0]?.[2]).toBe('<1')
    expect(AGE_BANDS.at(-1)?.[2]).toBe('60+')
    expect(SEX_VALUES.FEMENINO).toBe('F')
    expect(SEX_VALUES.HOMBRE).toBe('M')
    expect(UNKNOWN).toBe('unknown')
    expect(UBIGEO_LENGTH).toBe(6)
    expect(MIN_EPI_WEEK).toBe(1)
    expect(MAX_EPI_WEEK).toBe(53)
  })

  it('freezes the quality issue codes', () => {
    expect(QUALITY_ISSUE_CODES).toHaveLength(12)
    expect(new Set(QUALITY_ISSUE_CODES).size).toBe(QUALITY_ISSUE_CODES.length)
  })
})

describe('advanceEpiWeek', () => {
  it('matches the 52-week arithmetic', () => {
    expect(advanceEpiWeek(2024, 52, 1)).toEqual([2025, 1])
    expect(advanceEpiWeek(2024, 1, 0)).toEqual([2024, 1])
    expect(advanceEpiWeek(2024, 1, -1)).toEqual([2023, 52])
    expect(advanceEpiWeek(2024, 10, 43)).toEqual([2025, 1])
    expect(advanceEpiWeek(2023, 50, 6)).toEqual([2024, 4])
  })

  it.each(ADVANCE_TEST_CASES)('matches the oracle for %i-%i +%i', (year, week, steps, expected) => {
    expect(advanceEpiWeek(year, week, steps)).toEqual(expected)
  })
})
