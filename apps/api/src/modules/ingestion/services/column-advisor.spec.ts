import { describe, expect, it } from 'vitest'

import { parseSuggestions } from './column-advisor'

const COLUMNS = ['fecing', 'fecegr', 'PROCEDENCIA', 'sexo']

describe('parseSuggestions', () => {
  it('keeps the title, the topic and valid roles for real columns', () => {
    const text = JSON.stringify({
      title: 'Egresos hospitalarios 2026',
      topic: 'egresos hospitalarios',
      columns: [
        {
          column: 'fecing',
          label: 'Fecha de ingreso',
          role: 'date',
          level: null,
          field: null,
          reason: 'Inicio del caso.',
        },
        {
          column: 'PROCEDENCIA',
          label: 'Lugar de procedencia',
          role: 'place',
          level: 'location',
          field: null,
          reason: 'Junta departamento, provincia y distrito.',
        },
        { column: 'sexo', label: 'Sexo', role: 'category', level: null, field: 'sex', reason: 'X' },
      ],
    })
    expect(parseSuggestions(text, COLUMNS)).toEqual({
      title: 'Egresos hospitalarios 2026',
      topic: 'egresos hospitalarios',
      columns: [
        {
          column: 'fecing',
          label: 'Fecha de ingreso',
          role: 'date',
          level: null,
          field: null,
          reason: 'Inicio del caso.',
        },
        {
          column: 'PROCEDENCIA',
          label: 'Lugar de procedencia',
          role: 'place',
          level: 'location',
          field: null,
          reason: 'Junta departamento, provincia y distrito.',
        },
        {
          column: 'sexo',
          label: 'Sexo',
          role: 'category',
          level: null,
          field: 'sex',
          reason: 'X',
        },
      ],
    })
  })

  it('drops invented columns and unknown roles, levels and fields', () => {
    const text = JSON.stringify({
      columns: [
        { column: 'inventada', label: 'Nada', role: 'category' },
        { column: 'fecing', label: 'Fecha', role: 'fecha' },
        { column: 'PROCEDENCIA', label: 'Lugar', role: 'place', level: 'barrio' },
        { column: 'sexo', label: 'Sexo', role: 'category', field: 'genero' },
      ],
    })
    const result = parseSuggestions(text, COLUMNS)
    expect(result?.columns.map((item) => [item.column, item.role, item.level, item.field])).toEqual(
      [
        ['fecing', 'ignore', null, null],
        ['PROCEDENCIA', 'place', 'department', null],
        ['sexo', 'category', null, null],
      ],
    )
    expect(result?.title).toBeNull()
  })

  it('keeps only the first date when the AI proposes two', () => {
    const text = JSON.stringify({
      columns: [
        { column: 'fecing', label: 'Fecha de ingreso', role: 'date' },
        { column: 'fecegr', label: 'Fecha de egreso', role: 'date' },
      ],
    })
    expect(parseSuggestions(text, COLUMNS)?.columns.map((item) => item.role)).toEqual([
      'date',
      'ignore',
    ])
  })

  it('returns null for answers that are not the expected JSON', () => {
    expect(parseSuggestions('no es json', COLUMNS)).toBeNull()
    expect(parseSuggestions('{"otra":1}', COLUMNS)).toBeNull()
    expect(parseSuggestions('{"columns":[]}', COLUMNS)).toBeNull()
  })
})
