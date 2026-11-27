import { describe, expect, it } from 'vitest'

import {
  COLUMN_ROLES,
  ROLE_INFO,
  timeSupport,
  toEpiMapping,
  validateColumns,
  type DatasetColumn,
} from './roles'

// Arma una columna con valores por defecto para los tests
function column(name: string, role: DatasetColumn['role'], extra: Partial<DatasetColumn> = {}) {
  return {
    name,
    label: name,
    role,
    level: null,
    field: null,
    kind: 'text',
    ...extra,
  } as DatasetColumn
}

const DENGUE: DatasetColumn[] = [
  column('departamento', 'place', { level: 'department' }),
  column('provincia', 'place', { level: 'province' }),
  column('distrito', 'place', { level: 'district' }),
  column('enfermedad', 'category', { field: 'disease' }),
  column('ano', 'year', { kind: 'number' }),
  column('semana', 'week', { kind: 'number' }),
  column('diagnostico', 'category', { field: 'diagnosis' }),
  column('tipo_diagnostico', 'category', { field: 'diagnosis_type' }),
  column('ubigeo', 'place', { level: 'ubigeo' }),
  column('edad', 'measure', { field: 'age_group', kind: 'number' }),
  column('tipo_edad', 'category', { field: 'age_type' }),
  column('sexo', 'category', { field: 'sex' }),
  column('casos', 'count', { kind: 'number' }),
]

describe('column roles', () => {
  it('describes every role in Spanish', () => {
    expect(ROLE_INFO.map((role) => role.id)).toEqual([...COLUMN_ROLES])
    expect(ROLE_INFO.find((role) => role.id === 'measure')?.label).toBe('Valor medido')
  })
})

describe('toEpiMapping', () => {
  it('rebuilds the exact dengue mapping of the API snapshot', () => {
    expect(toEpiMapping(DENGUE)).toEqual({
      age_group: 'edad',
      age_type: 'tipo_edad',
      cases: 'casos',
      department: 'departamento',
      diagnosis: 'diagnostico',
      diagnosis_type: 'tipo_diagnostico',
      disease: 'enfermedad',
      district: 'distrito',
      epi_week: 'semana',
      province: 'provincia',
      sex: 'sexo',
      ubigeo: 'ubigeo',
      year: 'ano',
    })
  })

  it('maps a date and a combined location', () => {
    expect(
      toEpiMapping([
        column('fecing', 'date', { kind: 'date' }),
        column('PROCEDENCIA', 'place', { level: 'location' }),
        column('Id', 'identifier'),
      ]),
    ).toEqual({ event_date: 'fecing', location: 'PROCEDENCIA' })
  })
})

describe('timeSupport', () => {
  it('detects each kind of time', () => {
    expect(timeSupport([column('f', 'date')])).toBe('date')
    expect(timeSupport([column('a', 'year'), column('s', 'week')])).toBe('week')
    expect(timeSupport([column('a', 'year'), column('m', 'month')])).toBe('month')
    expect(timeSupport([column('a', 'year')])).toBe('year')
    expect(timeSupport([column('s', 'week')])).toBe('none')
    expect(timeSupport([column('x', 'category')])).toBe('none')
  })
})

describe('validateColumns', () => {
  it('keeps only the first date but allows several counts', () => {
    const result = validateColumns([
      column('fecing', 'date'),
      column('fecegr', 'date'),
      column('casos', 'count'),
      column('total', 'count'),
    ])
    expect(result.map((item) => item.role)).toEqual(['date', 'ignore', 'count', 'count'])
  })

  it('uses the first count in file order as the epidemiological cases', () => {
    const mapping = toEpiMapping(
      validateColumns([column('casos', 'count'), column('casos_2024', 'count')]),
    )
    expect(mapping.cases).toBe('casos')
  })

  it('drops the level outside places and defaults places to department', () => {
    const result = validateColumns([
      column('sexo', 'category', { level: 'district' }),
      column('region', 'place'),
    ])
    expect(result.map((item) => item.level)).toEqual([null, 'department'])
  })

  it('keeps one place per level', () => {
    const result = validateColumns([
      column('dep', 'place', { level: 'department' }),
      column('dep2', 'place', { level: 'department' }),
      column('prov', 'place', { level: 'province' }),
    ])
    expect(result.map((item) => item.role)).toEqual(['place', 'ignore', 'place'])
  })

  it('rejects a file with no useful column', () => {
    expect(() => validateColumns([column('Id', 'identifier'), column('x', 'ignore')])).toThrow(
      'ninguna columna útil',
    )
  })
})

describe('epidemiological fields', () => {
  it('solo acepta campos descriptivos en categorías y valores medidos', () => {
    const result = validateColumns([
      column('diresa', 'category', { field: 'department' as never }),
      column('atenciones', 'measure', { field: 'cases' as never }),
      column('viejo', 'ignore', { field: 'sex' }),
      column('sexo', 'category', { field: 'sex' }),
    ])
    expect(result.map((item) => item.field)).toEqual([null, null, null, 'sex'])
  })

  it('una columna sin uso nunca entra en la capa epidemiológica', () => {
    expect(toEpiMapping([column('viejo', 'ignore', { field: 'sex' })])).toEqual({})
  })
})
