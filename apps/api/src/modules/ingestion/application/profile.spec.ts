import { describe, expect, it } from 'vitest'

import { profileColumn, ruleSuggestion } from './profile'

const HEMOGLOBINA = ['11,2', '10.5', 's/d', '', '9,8', '12', '11', '10', '13', '12.1', '10.4', '11']

describe('profileColumn', () => {
  it('lee números con coma decimal y omite basura', () => {
    expect(profileColumn(HEMOGLOBINA)).toEqual({ kind: 'number', distinct: 10, filled: 11 })
  })

  it('detecta fechas', () => {
    expect(profileColumn(['14/07/2026', '03/07/2026', '2026-07-01']).kind).toBe('date')
  })

  it('trata como texto lo que no es mayormente número ni fecha', () => {
    expect(profileColumn(['FEMENINO', 'MASCULINO', 'FEMENINO']).kind).toBe('text')
  })
})

describe('ruleSuggestion', () => {
  it('usa el alias conocido antes que el perfil', () => {
    expect(ruleSuggestion('columna', profileColumn(['LIMA-LIMA-ATE']), 'location')).toEqual({
      role: 'place',
      level: 'location',
      field: null,
    })
    expect(ruleSuggestion('columna', profileColumn(['11', '3']), 'age_group')).toEqual({
      role: 'measure',
      level: null,
      field: 'age_group',
    })
    expect(ruleSuggestion('columna', profileColumn(['F', 'M']), 'sex')).toEqual({
      role: 'category',
      level: null,
      field: 'sex',
    })
    expect(ruleSuggestion('columna', profileColumn(['14/07/2026']), 'event_date').role).toBe('date')
  })

  it('texto casi único es identificador', () => {
    const ids = Array.from({ length: 20 }, (_, index) => `SATOA${29635 + index}AYA`)
    expect(ruleSuggestion('columna', profileColumn(ids), null).role).toBe('identifier')
  })

  it('números únicos son identificadores y números repetidos son valores medidos', () => {
    const records = Array.from({ length: 20 }, (_, index) => String(48213 + index))
    expect(ruleSuggestion('columna', profileColumn(records), null).role).toBe('identifier')
    expect(ruleSuggestion('columna', profileColumn(HEMOGLOBINA), null).role).toBe('measure')
  })

  it('texto con pocos valores es categoría y una sola constante no se usa', () => {
    expect(ruleSuggestion('columna', profileColumn(['SI', 'NO', 'SI', 'NO']), null).role).toBe(
      'category',
    )
    expect(ruleSuggestion('columna', profileColumn(['13/11/2026', '13/11/2026']), null).role).toBe(
      'ignore',
    )
    expect(ruleSuggestion('columna', profileColumn([]), null).role).toBe('ignore')
  })

  it('un encabezado de código es identificador aunque haya pocas filas', () => {
    expect(ruleSuggestion('Id', profileColumn(['A1', 'A2', 'A1']), null).role).toBe('identifier')
    expect(ruleSuggestion('nro_registro', profileColumn(['1', '2']), null).role).toBe('identifier')
    expect(ruleSuggestion('idioma', profileColumn(['ES', 'QU']), null).role).toBe('category')
  })

  it('una fecha sin alias se sugiere como fecha', () => {
    expect(ruleSuggestion('columna', profileColumn(['14/07/2026', '03/07/2026']), null).role).toBe(
      'date',
    )
  })
})
