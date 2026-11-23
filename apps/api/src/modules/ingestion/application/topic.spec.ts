import { describe, expect, it } from 'vitest'

import { inferTopic } from './topic'

describe('inferTopic', () => {
  it('reconoce el dengue por el nombre del archivo', () => {
    expect(inferTopic('dataset_dengue_actualizado (1).csv', 'minsa_dengue', {})).toBe('dengue')
  })

  it('reconoce el formato clásico de vigilancia MINSA', () => {
    expect(
      inferTopic('historico.csv', 'minsa_dengue', { ubigeo: 'u', year: 'a', epi_week: 's' }),
    ).toBe('dengue')
  })

  it('deja sin tema los demás archivos', () => {
    expect(
      inferTopic('Listado_egresos_hospitalarios_2026.csv', 'minsa_dengue', {
        event_date: 'fecing',
        location: 'PROCEDENCIA',
      }),
    ).toBe('')
  })
})
