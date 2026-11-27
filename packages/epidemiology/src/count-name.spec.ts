import { describe, expect, it } from 'vitest'

import { isWholeCount, looksLikeCountName } from './count-name'

describe('looksLikeCountName', () => {
  it.each([
    'casos',
    'casos_2024',
    'cas_mod',
    'cas_sev',
    'cas_sin_t',
    'CASOS LEVE',
    'n_ninos',
    'total',
    'atenciones',
    'atenc_cred',
    'consultas',
    'cons_nuevas',
    'recuperados',
    'visitas',
    'examenes',
    'exam_hb',
    'hemogramas',
    'niños',
    'personas',
    'pacientes',
    'egresos',
    'defunciones',
  ])('reconoce %s como cantidad', (name) => {
    expect(looksLikeCountName(name)).toBe(true)
  })

  it.each([
    'edad_media',
    'pct_anemia',
    'porc_casos',
    'tasa_incidencia',
    'hb',
    'hemoglobina',
    'prom',
  ])('reconoce %s como valor promediado', (name) => {
    expect(looksLikeCountName(name)).toBe(false)
  })

  it('reconoce cantidades sin la palabra casos', () => {
    expect(looksLikeCountName('cantidad')).toBe(true)
    expect(looksLikeCountName('cant_vacunas')).toBe(true)
    expect(looksLikeCountName('camas')).toBe(true)
    expect(looksLikeCountName('canton')).toBe(false)
    expect(looksLikeCountName('camara')).toBe(false)
  })

  it('considera también la etiqueta y el símbolo de porcentaje', () => {
    expect(looksLikeCountName('c1', 'Casos de anemia por año')).toBe(true)
    expect(looksLikeCountName('c1', 'Casos (%)')).toBe(false)
    expect(looksLikeCountName('altura')).toBe(false)
  })
})

describe('isWholeCount', () => {
  it('acepta solo enteros no negativos', () => {
    expect(isWholeCount(['0', '3', '12'])).toBe(true)
    expect(isWholeCount(['3', '2,5'])).toBe(false)
    expect(isWholeCount(['3', '-1'])).toBe(false)
    expect(isWholeCount([])).toBe(false)
  })
})
