import { describe, expect, it } from 'vitest'

import { profileColumn, ruleSuggestion } from './profile'

const HEMOGLOBINA = ['11,2', '10.5', 's/d', '', '9,8', '12', '11', '10', '13', '12.1', '10.4', '11']

describe('profileColumn', () => {
  it('calcula mínimo y máximo de columnas muy grandes sin fallar', () => {
    const values = Array.from({ length: 200_000 }, (_, index) => String(index))
    const profile = profileColumn(values)
    expect(profile.min).toBe(0)
    expect(profile.max).toBe(199_999)
  })

  it('lee números con coma decimal y omite basura', () => {
    expect(profileColumn(HEMOGLOBINA)).toEqual({
      kind: 'number',
      distinct: 10,
      filled: 11,
      whole: false,
      min: 9.8,
      max: 13,
      spaced: false,
    })
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

  it('un entero no negativo con nombre de cantidad es cantidad y varias columnas pueden serlo', () => {
    const values = ['0', '3', '12', '5', '7']
    for (const name of ['casos', 'casos_2024', 'cas_mod', 'cas_sin_t', 'atenciones']) {
      expect(ruleSuggestion(name, profileColumn(values), null).role).toBe('count')
    }
  })

  it('decimales, promedios y enteros sin nombre de cantidad son valores medidos', () => {
    const whole = ['0', '3', '12', '5', '7']
    expect(ruleSuggestion('casos', profileColumn(['1,5', '3', '2']), null).role).toBe('measure')
    expect(ruleSuggestion('edad_media', profileColumn(whole), null).role).toBe('measure')
    expect(ruleSuggestion('pct_anemia', profileColumn(whole), null).role).toBe('measure')
    expect(ruleSuggestion('altura', profileColumn(whole), null).role).toBe('measure')
  })

  it('un entero casi único con nombre de cantidad es cantidad, no identificador', () => {
    const values = Array.from({ length: 20 }, (_, index) => String(100000 + index * 137))
    for (const name of ['poblacion', 'habitantes', 'nacidos', 'vacunados', 'afiliados']) {
      expect(ruleSuggestion(name, profileColumn(values), null).role, name).toBe('count')
    }
    expect(ruleSuggestion('columna', profileColumn(values), null).role).toBe('identifier')
  })

  it('texto libre casi único se ignora y un código sin espacios es identificador', () => {
    const free = Array.from({ length: 20 }, (_, index) => `paciente refiere dolor ${index}`)
    expect(ruleSuggestion('obs', profileColumn(free), null).role).toBe('ignore')
    const codes = Array.from({ length: 20 }, (_, index) => `AB${1000 + index}`)
    expect(ruleSuggestion('obs', profileColumn(codes), null).role).toBe('identifier')
  })

  it('el mes, la semana y el año se reconocen por encabezado y rango', () => {
    const months = Array.from({ length: 12 }, (_, index) => String(index + 1))
    const weeks = Array.from({ length: 20 }, (_, index) => String(index + 1))
    const years = ['2023', '2024', '2025', '2024']
    expect(ruleSuggestion('mes', profileColumn(months), null).role).toBe('month')
    expect(ruleSuggestion('month', profileColumn(months), null).role).toBe('month')
    expect(ruleSuggestion('semana', profileColumn(weeks), null).role).toBe('week')
    expect(ruleSuggestion('se', profileColumn(weeks), null).role).toBe('week')
    expect(ruleSuggestion('anio', profileColumn(years), null).role).toBe('year')
    expect(ruleSuggestion('año', profileColumn(years), null).role).toBe('year')
    expect(ruleSuggestion('mes', profileColumn(['10', '1446']), null).role).toBe('measure')
  })

  it('un texto con encabezado de lugar es lugar con su nivel, salvo que sea un código', () => {
    const names = ['ATE', 'ANCON', 'COMAS', 'ATE']
    const level = (name: string) => ruleSuggestion(name, profileColumn(names), null)
    expect(level('nom_dist')).toMatchObject({ role: 'place', level: 'district' })
    expect(level('Distrito')).toMatchObject({ role: 'place', level: 'district' })
    expect(level('nombre_provincia')).toMatchObject({ role: 'place', level: 'province' })
    expect(level('dpto')).toMatchObject({ role: 'place', level: 'department' })
    expect(level('Región')).toMatchObject({ role: 'place', level: 'department' })
    expect(level('cod_dist').role).not.toBe('place')
    expect(ruleSuggestion('region', profileColumn(['LIMA', 'LIMA']), null)).toMatchObject({
      role: 'place',
      level: 'department',
    })
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
