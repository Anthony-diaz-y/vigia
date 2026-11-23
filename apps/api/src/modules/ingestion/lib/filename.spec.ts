import { describe, expect, it } from 'vitest'

import { decodeFilename } from './filename'

describe('decodeFilename', () => {
  it('recupera tildes y eñes de un nombre leído como latin1', () => {
    const garbled = Buffer.from('Registro_niños_0a6_años.csv', 'utf8').toString('latin1')
    expect(decodeFilename(garbled)).toBe('Registro_niños_0a6_años.csv')
  })

  it('deja igual un nombre que ya está bien', () => {
    expect(decodeFilename('egresos.csv')).toBe('egresos.csv')
    expect(decodeFilename('año.csv')).toBe('año.csv')
  })
})
