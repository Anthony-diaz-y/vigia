import { describe, expect, it } from 'vitest'

import {
  MISSING_VALUE,
  displayValue,
  isCodedValueSet,
  sanitizeValueLabels,
  valueRules,
} from './values'

// Traduce una lista de valores crudos como lo haría el tablero
function shown(header: string, values: string[]): string[] {
  const rules = valueRules(header, values)
  return values.map((value) => displayValue(value, rules))
}

describe('valores sí/no', () => {
  it('traduce S/N, SI/NO y variantes sin importar mayúsculas ni tildes', () => {
    expect(shown('x', ['S', 'N', 's'])).toEqual(['Sí', 'No', 'Sí'])
    expect(shown('x', ['SI', 'NO', 'Sí'])).toEqual(['Sí', 'No', 'Sí'])
    expect(shown('x', ['yes', 'FALSE', 'Verdadero', 'falso'])).toEqual(['Sí', 'No', 'Sí', 'No'])
  })

  it('ignora el sin dato al decidir si la columna es sí/no', () => {
    expect(shown('NOTIFICA', ['S', 'N', 'DESCONOCIDO'])).toEqual(['Sí', 'No', MISSING_VALUE])
  })

  it('acepta 1/0 solo cuando el encabezado es una pregunta sí/no', () => {
    expect(shown('notifica', ['1', '0', '1'])).toEqual(['Sí', 'No', 'Sí'])
    expect(shown('ESTABLECIMIENTO_PRIORIZADO_2024', ['1', '0'])).toEqual(['Sí', 'No'])
    expect(shown('tiene_seguro', ['1', '0'])).toEqual(['Sí', 'No'])
    expect(shown('es_rural', ['1', '0'])).toEqual(['Sí', 'No'])
    expect(shown('flag_activo', ['1', '0'])).toEqual(['Sí', 'No'])
    expect(shown('nivel', ['1', '0'])).toEqual(['1', '0'])
  })

  it('no toca una columna con otros valores además de sí/no', () => {
    expect(shown('x', ['S', 'N', 'TALVEZ'])).toEqual(['S', 'N', 'TALVEZ'])
    expect(shown('x', ['1', '2'])).toEqual(['1', '2'])
  })
})

describe('valores sin dato', () => {
  it('reconoce los textos vacíos o de ausencia', () => {
    const values = [
      '',
      '-',
      'NA',
      'N/A',
      'null',
      'none',
      'ND',
      'S/D',
      'sd',
      'Sin dato',
      'sin información',
      'desconocido',
      'No registra',
      '-1',
      'A',
    ]
    const rules = valueRules('tipo', values)
    expect(values.map((value) => displayValue(value, rules))).toEqual([
      ...Array<string>(13).fill(MISSING_VALUE),
      MISSING_VALUE,
      'A',
    ])
  })

  it('999999 entre códigos 1 y 2 es sin dato', () => {
    expect(shown('ESTADO', ['1', '2', '999999', '1'])).toEqual(['1', '2', MISSING_VALUE, '1'])
    expect(shown('nivel', ['1', '2', '3', '999999'])).toEqual(['1', '2', '3', MISSING_VALUE])
    expect(shown('x', ['1', '2', '9'])).toEqual(['1', '2', MISSING_VALUE])
  })

  it('99 entre valores del 1 al 120 no es un centinela', () => {
    const values = Array.from({ length: 120 }, (_, index) => String(index + 1))
    expect(shown('edad', values)).toEqual(values)
  })

  it('un 9 dentro de códigos del 1 al 8 es un valor real', () => {
    const values = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
    expect(shown('x', values)).toEqual(values)
  })

  it('no hay centinela numérico sin otros códigos con los que comparar', () => {
    expect(shown('x', ['999999', '999999'])).toEqual(['999999', '999999'])
  })
})

describe('isCodedValueSet', () => {
  it('acepta pocos códigos numéricos o de hasta tres letras', () => {
    expect(isCodedValueSet('ESTADO', ['1', '2', '999999'])).toBe(true)
    expect(isCodedValueSet('TIPO', ['A', 'X', 'C', 'D', 'DESCONOCIDO'])).toBe(true)
  })

  it('rechaza sí/no, texto largo, uno solo y demasiados valores', () => {
    expect(isCodedValueSet('NOTIFICA', ['S', 'N'])).toBe(false)
    expect(isCodedValueSet('categoria', ['I-1', 'I-2'])).toBe(false)
    expect(isCodedValueSet('red', ['1'])).toBe(false)
    expect(
      isCodedValueSet(
        'x',
        Array.from({ length: 13 }, (_, index) => String(index + 1)),
      ),
    ).toBe(false)
  })
})

describe('sanitizeValueLabels', () => {
  it('deja solo códigos conocidos con etiquetas de 1 a 60 letras', () => {
    expect(
      sanitizeValueLabels(
        { '1': ' Activo ', '2': 'Inactivo', '7': 'Desconocido', '3': 'x'.repeat(61), '4': '' },
        ['1', '2', '3', '4'],
      ),
    ).toEqual({ '1': 'Activo', '2': 'Inactivo' })
  })

  it('devuelve undefined si no queda nada o no es un objeto', () => {
    expect(sanitizeValueLabels({ '9': 'x' }, ['1'])).toBeUndefined()
    expect(sanitizeValueLabels(['a'], ['1'])).toBeUndefined()
    expect(sanitizeValueLabels(null, ['1'])).toBeUndefined()
    expect(sanitizeValueLabels({ '1': 5 }, ['1'])).toBeUndefined()
  })
})
