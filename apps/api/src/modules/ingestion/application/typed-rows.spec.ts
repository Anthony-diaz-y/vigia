import type { DatasetColumn } from '@vigia/epidemiology'
import { describe, expect, it } from 'vitest'

import { typedRows } from './typed-rows'

// Arma una columna con valores por defecto para los tests
function column(name: string, role: DatasetColumn['role'], level: DatasetColumn['level'] = null) {
  return { name, label: name, role, level, field: null, kind: 'text' } as DatasetColumn
}

const COLUMNS = [
  column('Id', 'identifier'),
  column('fecing', 'date'),
  column('PROCEDENCIA', 'place', 'location'),
  column('sexo', 'category'),
  column('hemoglobina', 'measure'),
  column('casos', 'count'),
  column('FECHA_CORTE', 'ignore'),
]

describe('typedRows', () => {
  it('guarda solo columnas útiles, con fechas ISO y números', () => {
    const rows = typedRows(
      [
        {
          Id: 'SATOA29635AYA',
          fecing: '14/07/2026',
          PROCEDENCIA: 'LIMA-LIMA-ATE',
          sexo: ' FEMENINO ',
          hemoglobina: '11,2',
          casos: '2',
          FECHA_CORTE: '13/11/2026',
        },
      ],
      COLUMNS,
    )
    expect(rows).toEqual([
      {
        fecing: '2026-07-14',
        PROCEDENCIA: 'LIMA-LIMA-ATE',
        sexo: 'FEMENINO',
        hemoglobina: 11.2,
        casos: 2,
      },
    ])
  })

  it('deja en null los valores vacíos o ilegibles', () => {
    const rows = typedRows(
      [{ Id: 'X', fecing: 'sin fecha', PROCEDENCIA: '', sexo: '', hemoglobina: 's/d', casos: '' }],
      COLUMNS,
    )
    expect(rows).toEqual([
      { fecing: null, PROCEDENCIA: null, sexo: null, hemoglobina: null, casos: null },
    ])
  })
})

describe('time values', () => {
  const TIME = [
    column('ano', 'year'),
    column('semana', 'week'),
    column('mes', 'month'),
    column('fecha', 'date'),
  ]

  it('descarta años, semanas, meses y fechas fuera de rango', () => {
    expect(typedRows([{ ano: '202', semana: '60', mes: '13', fecha: '01/01/0201' }], TIME)).toEqual(
      [{ ano: null, semana: null, mes: null, fecha: null }],
    )
    expect(typedRows([{ ano: '2024', semana: '5.5', mes: '0', fecha: '' }], TIME)).toEqual([
      { ano: 2024, semana: null, mes: null, fecha: null },
    ])
  })

  it('conserva valores de tiempo válidos', () => {
    expect(
      typedRows([{ ano: '2024', semana: '53', mes: '12', fecha: '31/12/2024' }], TIME),
    ).toEqual([{ ano: 2024, semana: 53, mes: 12, fecha: '2024-12-31' }])
  })
})
