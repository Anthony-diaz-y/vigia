import { describe, expect, it } from 'vitest'

import { mergeActions, parseActions } from './action-advisor'

const PLACES = ['JUNIN', 'PIURA']

describe('parseActions', () => {
  it('descarta lugares inexistentes y recorta a 2 acciones', () => {
    const text = JSON.stringify({
      acciones: [
        { lugar: 'JUNIN', acciones: ['Revisar el tamizaje.', 'Reforzar la consejería.', 'Otra.'] },
        { lugar: 'LORETO', acciones: ['Inventada.'] },
      ],
    })
    expect(parseActions(text, PLACES)).toEqual({
      JUNIN: ['Revisar el tamizaje.', 'Reforzar la consejería.'],
    })
  })

  it('descarta acciones largas o con indicaciones de medicamentos', () => {
    const long = Array.from({ length: 25 }, () => 'palabra').join(' ')
    const text = JSON.stringify({
      acciones: [
        {
          lugar: 'PIURA',
          acciones: [
            long,
            'Administrar 60 mg de hierro diario.',
            'Revisar el registro de la zona.',
          ],
        },
      ],
    })
    expect(parseActions(text, PLACES)).toEqual({ PIURA: ['Revisar el registro de la zona.'] })
  })

  it('devuelve null si la respuesta no es el JSON esperado', () => {
    expect(parseActions('no', PLACES)).toBeNull()
    expect(parseActions('{"acciones":[]}', PLACES)).toBeNull()
  })
})

describe('mergeActions', () => {
  const items = [
    { department: 'JUNIN', actions: ['Regla A.'] },
    { department: 'PIURA', actions: ['Regla B.'] },
  ]

  it('marca como sugeridas por IA solo las acciones reemplazadas', () => {
    expect(mergeActions(items, { JUNIN: ['IA 1.'] })).toEqual([
      { department: 'JUNIN', actions: ['IA 1.'], actions_source: 'deepseek' },
      { department: 'PIURA', actions: ['Regla B.'], actions_source: 'rules' },
    ])
  })

  it('sin sugerencias deja todas las acciones de las reglas', () => {
    expect(mergeActions(items, null).every((item) => item.actions_source === 'rules')).toBe(true)
  })
})
