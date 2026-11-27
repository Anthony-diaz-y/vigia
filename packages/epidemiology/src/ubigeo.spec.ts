import { describe, expect, it } from 'vitest'

import { UBIGEO_DEPARTMENTS, UBIGEO_DISTRICTS, UBIGEO_PROVINCES } from './ubigeo/catalog'
import { detectUbigeoLevel, resolveUbigeo, ubigeoHeaderLevel, ubigeoPlaceName } from './ubigeo'

describe('catálogo UBIGEO', () => {
  it('tiene 25 departamentos, 196 provincias y más de 1800 distritos', () => {
    expect(Object.keys(UBIGEO_DEPARTMENTS)).toHaveLength(25)
    expect(Object.keys(UBIGEO_PROVINCES)).toHaveLength(196)
    expect(Object.keys(UBIGEO_DISTRICTS).length).toBeGreaterThan(1800)
  })

  it('usa códigos INEI, no RENIEC', () => {
    expect(UBIGEO_DEPARTMENTS['03']).toBe('Apurimac')
    expect(UBIGEO_PROVINCES['0302']).toBe('Andahuaylas')
    expect(UBIGEO_DISTRICTS['030213']).toBe('San Jeronimo')
    expect(UBIGEO_DISTRICTS['150101']).toBe('Lima')
  })
})

describe('resolveUbigeo', () => {
  it('resuelve por la longitud del código', () => {
    expect(resolveUbigeo('03')).toBe('Apurimac')
    expect(resolveUbigeo('0302')).toBe('Andahuaylas')
    expect(resolveUbigeo('030213')).toBe('San Jeronimo')
  })

  it('restaura el cero inicial perdido al leer como número', () => {
    expect(resolveUbigeo('302')).toBe('Andahuaylas')
    expect(resolveUbigeo('30213')).toBe('San Jeronimo')
    expect(resolveUbigeo('3', 'department')).toBe('Apurimac')
    expect(resolveUbigeo(302, 'province')).toBe('Andahuaylas')
    expect(resolveUbigeo('0302.0')).toBe('Andahuaylas')
  })

  it('respeta el nivel pedido y devuelve null si no coincide', () => {
    expect(resolveUbigeo('0302', 'province')).toBe('Andahuaylas')
    expect(resolveUbigeo('0302', 'district')).toBeNull()
  })

  it('devuelve null para códigos desconocidos o que no son números', () => {
    expect(resolveUbigeo('9999')).toBeNull()
    expect(resolveUbigeo('999999')).toBeNull()
    expect(resolveUbigeo('Andahuaylas')).toBeNull()
    expect(resolveUbigeo('')).toBeNull()
    expect(resolveUbigeo(null)).toBeNull()
  })
})

describe('ubigeoPlaceName', () => {
  it('agrega la provincia solo cuando el nombre del distrito se repite', () => {
    expect(ubigeoPlaceName('030213')).toBe('San Jeronimo, Andahuaylas')
    expect(ubigeoPlaceName('150101')).toBe('Lima')
    expect(ubigeoPlaceName('030101')).toBe('Abancay')
    expect(ubigeoPlaceName('0302')).toBe('Andahuaylas')
    expect(ubigeoPlaceName('999999')).toBeNull()
  })
})

describe('detectUbigeoLevel', () => {
  it('detecta el nivel cuando casi todos los valores se resuelven', () => {
    expect(detectUbigeoLevel(['0301', '0302', '0303', ''])).toBe('province')
    expect(detectUbigeoLevel(['030101', '030201', '030213'])).toBe('district')
    expect(detectUbigeoLevel(['03', '04', '15'])).toBe('department')
    expect(detectUbigeoLevel(['301', '302', '303'])).toBe('province')
  })

  it('devuelve null si menos del 90 % se resuelve o no hay valores', () => {
    expect(detectUbigeoLevel(['0301', '0302', '9999', '9998'])).toBeNull()
    expect(detectUbigeoLevel(['Lima', 'Cusco'])).toBeNull()
    expect(detectUbigeoLevel(['', ' '])).toBeNull()
  })
})

describe('ubigeoHeaderLevel', () => {
  it('reconoce encabezados de código de lugar', () => {
    expect(ubigeoHeaderLevel('cod_prov')).toBe('province')
    expect(ubigeoHeaderLevel('COD_DIST')).toBe('district')
    expect(ubigeoHeaderLevel('codigo_provincia')).toBe('province')
    expect(ubigeoHeaderLevel('ubigeo_dep')).toBe('department')
    expect(ubigeoHeaderLevel('Código de distrito')).toBe('district')
  })

  it('ignora nombres y otros códigos', () => {
    expect(ubigeoHeaderLevel('nom_dist')).toBeNull()
    expect(ubigeoHeaderLevel('distrito')).toBeNull()
    expect(ubigeoHeaderLevel('cod_red')).toBeNull()
    expect(ubigeoHeaderLevel('ubigeo')).toBeNull()
  })
})
