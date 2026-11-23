import { describe, expect, it } from 'vitest'

import {
  MAPPING_TARGET_INFO,
  MAPPING_TARGETS,
  cleanDepartment,
  epiWeekOf,
  isMappingTarget,
  missingRequirements,
  parseDate,
  parseNumber,
  splitLocation,
} from './fields'

// Convierte una fecha ISO en año y semana epidemiológica
function week(iso: string) {
  return epiWeekOf(new Date(`${iso}T00:00:00Z`))
}

describe('mapping targets', () => {
  it('describes every target in Spanish exactly once', () => {
    expect(MAPPING_TARGET_INFO.map((item) => item.id).sort()).toEqual([...MAPPING_TARGETS].sort())
  })

  it('recognizes only known targets', () => {
    expect(isMappingTarget('event_date')).toBe(true)
    expect(isMappingTarget('department')).toBe(true)
    expect(isMappingTarget('fecing')).toBe(false)
  })
})

describe('missingRequirements', () => {
  it('accepts a date and a combined location', () => {
    expect(missingRequirements(['event_date', 'location'])).toEqual([])
  })

  it('accepts year, week and ubigeo', () => {
    expect(missingRequirements(['year', 'epi_week', 'ubigeo'])).toEqual([])
  })

  it('needs both year and week when there is no date', () => {
    expect(missingRequirements(['year', 'department']).map((group) => group.id)).toEqual(['time'])
  })

  it('reports both groups for an unusable file', () => {
    expect(missingRequirements(['sex']).map((group) => group.id)).toEqual(['time', 'place'])
  })
})

describe('parseDate', () => {
  it('reads Peruvian day-first dates', () => {
    expect(parseDate('14/07/2026')?.toISOString()).toBe('2026-07-14T00:00:00.000Z')
    expect(parseDate('3-1-2026')?.toISOString()).toBe('2026-01-03T00:00:00.000Z')
  })

  it('reads ISO dates, with or without time', () => {
    expect(parseDate('2026-07-14')?.toISOString()).toBe('2026-07-14T00:00:00.000Z')
    expect(parseDate('2026-07-14T00:00:00.000Z')?.toISOString()).toBe('2026-07-14T00:00:00.000Z')
  })

  it('reads compact year-month-day dates within a plausible range', () => {
    expect(parseDate('20260630')?.toISOString()).toBe('2026-06-30T00:00:00.000Z')
    expect(parseDate('12345678')).toBeNull()
    expect(parseDate('20261340')).toBeNull()
  })

  it('rejects impossible or unreadable dates', () => {
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('julio 2026')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('parseNumber', () => {
  it('lee números con coma o punto decimal', () => {
    expect(parseNumber('11,2')).toBe(11.2)
    expect(parseNumber(' 10.5 ')).toBe(10.5)
    expect(parseNumber('-3')).toBe(-3)
  })

  it('rechaza texto, vacíos y miles ambiguos', () => {
    expect(parseNumber('s/d')).toBeNull()
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('12abc')).toBeNull()
  })
})

describe('epiWeekOf', () => {
  it('starts week 1 on the Sunday of the first week with four days of January', () => {
    expect(week('2026-01-04')).toEqual({ year: 2026, epi_week: 1 })
    expect(week('2024-01-01')).toEqual({ year: 2024, epi_week: 1 })
  })

  it('assigns early January days to the last week of the previous year', () => {
    expect(week('2026-01-01')).toEqual({ year: 2025, epi_week: 53 })
    expect(week('2021-01-02')).toEqual({ year: 2020, epi_week: 53 })
  })

  it('assigns late December days to week 1 of the next year', () => {
    expect(week('2024-12-31')).toEqual({ year: 2025, epi_week: 1 })
  })

  it('runs weeks from Sunday to Saturday', () => {
    expect(week('2026-07-12')).toEqual({ year: 2026, epi_week: 28 })
    expect(week('2026-07-18')).toEqual({ year: 2026, epi_week: 28 })
    expect(week('2026-07-19')).toEqual({ year: 2026, epi_week: 29 })
  })
})

describe('location', () => {
  it('splits department, province and district', () => {
    expect(splitLocation('LIMA-LIMA-SANTA ANITA')).toEqual({
      department: 'LIMA',
      province: 'LIMA',
      district: 'SANTA ANITA',
    })
  })

  it('keeps hyphenated district names whole', () => {
    expect(splitLocation('HUANUCO-LEONCIO PRADO-RUPA-RUPA').district).toBe('RUPA-RUPA')
  })

  it('ignores stray slashes inside a hyphen-separated location', () => {
    expect(splitLocation('AYACUCHO-HUAMANGA-CARMEN ALTO 1/')).toEqual({
      department: 'AYACUCHO',
      province: 'HUAMANGA',
      district: 'CARMEN ALTO 1/',
    })
  })

  it('unifies department variants', () => {
    expect(splitLocation('PROVINCIAS DE LIMA-HUARAL-HUARAL').department).toBe('LIMA')
    expect(splitLocation('DEL CALLAO-CALLAO-CALLAO').department).toBe('CALLAO')
    expect(cleanDepartment('Huánuco')).toBe('HUANUCO')
    expect(cleanDepartment('Provincia Constitucional del Callao')).toBe('CALLAO')
    expect(cleanDepartment('Lima Metropolitana')).toBe('LIMA')
  })

  it('accepts slashes as separators', () => {
    expect(splitLocation('Cusco / Cusco / Santiago')).toEqual({
      department: 'CUSCO',
      province: 'CUSCO',
      district: 'SANTIAGO',
    })
  })
})
