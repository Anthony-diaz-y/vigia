import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { EmptyFile, NoUsefulColumns, UnsupportedFile } from './errors'
import { toEpiMapping } from '@vigia/epidemiology'

import { ingestUpload, previewUpload } from './ingest'

const HEADER =
  'departamento,provincia,distrito,enfermedad,ano,semana,' +
  'diagnostico,tipo_diagnostico,ubigeo,edad,tipo_edad,sexo,casos\n'

interface IngestSnapshot {
  file_hash: string
  status: string
  rows_in: number
  rows_valid: number
  rows_dropped: number
  duplicates_collapsed: number
  mapping: Record<string, string>
  unmapped_columns: string[]
  quality: Record<string, unknown>
  rows: unknown[]
}

// Lee un archivo de fixtures normalizando los saltos de línea a LF
function fixture(name: string): Buffer {
  const raw = readFileSync(resolve(process.cwd(), 'test', 'fixtures', name))
  return Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
}

// Carga el snapshot JSON esperado de una ingesta
function snapshot(name: string): IngestSnapshot {
  const path = resolve(process.cwd(), 'test', 'snapshots', name)
  return JSON.parse(readFileSync(path, 'utf8')) as IngestSnapshot
}

// Ingiere un fixture con la fuente minsa_dengue
function upload(name: string) {
  return ingestUpload({
    data: fixture(name),
    filename: name,
    source: 'minsa_dengue',
  })
}

describe('ingestion parity with the frozen fixtures', () => {
  it.each([
    ['minsa_dengue_clean.csv', 'ingest_clean.json'],
    ['analysis_synthetic.csv', 'ingest_synthetic.json'],
    ['demo_624.csv', 'ingest_demo.json'],
  ])('matches %s row for row', async (fixtureName, snapshotName) => {
    const result = await upload(fixtureName)
    const expected = snapshot(snapshotName)

    expect(result.fileHash).toBe(expected.file_hash)
    expect(result.status).toBe(expected.status)
    expect(result.rowsIn).toBe(expected.rows_in)
    expect(result.rowsValid).toBe(expected.rows_valid)
    expect(result.rowsDropped).toBe(expected.rows_dropped)
    expect(result.duplicatesCollapsed).toBe(expected.duplicates_collapsed)
    expect(result.mapping).toEqual(expected.mapping)
    expect(result.unmappedColumns).toEqual(expected.unmapped_columns)
    expect({
      rows_in: result.rowsIn,
      rows_valid: result.rowsValid,
      rows_dropped: result.rowsDropped,
      duplicates_collapsed: result.duplicatesCollapsed,
      mapped_columns: result.mapping,
      unmapped_columns: result.unmappedColumns,
      issues: result.issues,
      source_format: result.sourceFormat,
      encoding: result.encoding,
      delimiter: result.delimiter,
    }).toEqual(expected.quality)
    expect(result.rows).toEqual(expected.rows)
  })

  it('previews the demo file with the same rule-based mapping as the API snapshot', async () => {
    const preview = await previewUpload({
      data: fixture('demo_624.csv'),
      filename: 'historico.csv',
      source: 'minsa_dengue',
    })
    const expected = JSON.parse(
      readFileSync(resolve(process.cwd(), 'test', 'snapshots', 'api_preview_demo.json'), 'utf8'),
    ) as { columns: string[]; mapping: Record<string, string> }

    expect(preview.suggested_by).toBe('rules')
    expect(preview.title).toBe('historico')
    expect(preview.topic).toBe('dengue')
    expect(preview.rows).toBe(624)
    expect(preview.columns.map((column) => column.name)).toEqual(expected.columns)
    expect(toEpiMapping(preview.columns)).toEqual(expected.mapping)
    expect(preview.roles.map((role) => role.id)).toContain('measure')
  })
})

describe('ingestion rejection paths', () => {
  it('acepta columnas de datos personales pero nunca las guarda', async () => {
    const csv = Buffer.from(
      'departamento,ano,semana,ubigeo,casos,dni\nLORETO,2024,1,160110,2,12345678\n',
    )
    const reviewed = await previewUpload({ data: csv, filename: 'pii.csv', source: 'minsa_dengue' })
    const result = await ingestUpload({
      data: csv,
      filename: 'pii.csv',
      source: 'minsa_dengue',
      columns: reviewed.columns.map(({ samples: _samples, reason: _reason, ...column }) =>
        column.name === 'dni' ? { ...column, role: 'category' as const } : column,
      ),
    })
    expect(result.rowsValid).toBe(1)
    expect(result.columns.find((column) => column.name === 'dni')?.role).toBe('identifier')
    expect(result.genericRows.every((row) => !('dni' in row))).toBe(true)
  })

  it('keeps a file without place as a generic dataset without the epidemiological layer', async () => {
    const result = await ingestUpload({
      data: Buffer.from('ano,semana,casos\n2024,1,2\n'),
      filename: 'sin-lugar.csv',
      source: 'minsa_dengue',
    })
    expect(result.epi).toBe(false)
    expect(result.rows).toEqual([])
    expect(result.genericRows).toEqual([{ ano: 2024, semana: 1, casos: 2 }])
  })

  it('keeps a file without week as a generic dataset', async () => {
    const result = await ingestUpload({
      data: Buffer.from('departamento,ano,casos\nLORETO,2024,2\n'),
      filename: 'sin-semana.csv',
      source: 'minsa_dengue',
    })
    expect(result.epi).toBe(false)
    expect(result.rowsValid).toBe(1)
  })

  it('rejects a file whose columns are all identifiers', async () => {
    await expect(
      ingestUpload({
        data: Buffer.from('Id\nA1\nA2\n'),
        filename: 'ids.csv',
        source: 'minsa_dengue',
      }),
    ).rejects.toThrow(NoUsefulColumns)
  })

  it('rejects legacy workbook formats', async () => {
    await expect(
      ingestUpload({
        data: Buffer.from('not an xls'),
        filename: 'historico.xls',
        source: 'minsa_dengue',
      }),
    ).rejects.toThrow(UnsupportedFile)
  })

  it('rejects a header-only csv', async () => {
    await expect(
      ingestUpload({
        data: Buffer.from(HEADER),
        filename: 'empty.csv',
        source: 'minsa_dengue',
      }),
    ).rejects.toThrow(EmptyFile)
  })
})

describe('normalization rules', () => {
  it('collapses duplicate natural keys and sums their cases', async () => {
    const row =
      'LORETO,MAYNAS,IQUITOS,DENGUE,2024,1,DENGUE SIN SIGNOS DE ALARMA,CONFIRMADO,160110,12,ANOS,F'
    const result = await ingestUpload({
      data: Buffer.from(`${HEADER}${row},2\n${row},3\n`),
      filename: 'duplicates.csv',
      source: 'minsa_dengue',
    })

    expect(result.rowsIn).toBe(2)
    expect(result.rowsValid).toBe(1)
    expect(result.duplicatesCollapsed).toBe(1)
    expect(result.rows[0]?.cases).toBe(5)
    expect(result.status).toBe('ok')
  })

  it('classifies dropped rows and keeps a Spanish quality message', async () => {
    const row =
      'LORETO,MAYNAS,IQUITOS,DENGUE,2024,1,DENGUE SIN SIGNOS DE ALARMA,CONFIRMADO,12AB,12,ANOS,F,2'
    const result = await ingestUpload({
      data: Buffer.from(`${HEADER}${row}\n`),
      filename: 'invalid-ubigeo.csv',
      source: 'minsa_dengue',
    })

    expect(result.rowsValid).toBe(0)
    expect(result.rowsDropped).toBe(1)
    expect(result.status).toBe('ok_with_issues')
    expect(result.issues).toEqual([
      {
        code: 'invalid_ubigeo',
        message: 'UBIGEO is not a 6-digit code.',
        count: 1,
        sample: ['12AB'],
      },
    ])
  })

  it('reads the same contract from an xlsx workbook', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('datos')
    sheet.addRow([
      'departamento',
      'provincia',
      'distrito',
      'enfermedad',
      'ano',
      'semana',
      'diagnostico',
      'tipo_diagnostico',
      'ubigeo',
      'edad',
      'tipo_edad',
      'sexo',
      'casos',
    ])
    sheet.addRow([
      'LORETO',
      'MAYNAS',
      'IQUITOS',
      'DENGUE',
      2024,
      1,
      'DENGUE SIN SIGNOS DE ALARMA',
      'CONFIRMADO',
      '160110',
      12,
      'ANOS',
      'F',
      3,
    ])
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())

    const result = await ingestUpload({
      data: buffer,
      filename: 'historico.xlsx',
      source: 'minsa_dengue',
    })

    expect(result.sourceFormat).toBe('xlsx')
    expect(result.encoding).toBeNull()
    expect(result.delimiter).toBeNull()
    expect(result.rows).toEqual([
      {
        disease: 'DENGUE',
        ubigeo: '160110',
        year: 2024,
        epi_week: 1,
        department: 'LORETO',
        province: 'MAYNAS',
        district: 'IQUITOS',
        directorate: '',
        sex: 'F',
        age_group: '10-19',
        age_type: 'ANOS',
        diagnosis: 'DENGUE SIN SIGNOS DE ALARMA',
        diagnosis_type: 'CONFIRMADO',
        cases: 3,
      },
    ])
  })

  it('fills trailing columns missing from a short csv row', async () => {
    const result = await ingestUpload({
      data: Buffer.from(`${HEADER}LORETO,MAYNAS,IQUITOS,DENGUE,2024,1,,,160110\n`),
      filename: 'short.csv',
      source: 'minsa_dengue',
    })

    expect(result.rowsIn).toBe(1)
    expect(result.rowsValid).toBe(0)
    expect(result.rowsDropped).toBe(1)
    expect(result.issues.map((issue) => issue.code)).toEqual(['missing_cases'])
  })

  it('keeps an all-empty comma row instead of silently dropping it', async () => {
    const result = await ingestUpload({
      data: Buffer.from(`${HEADER},,,,,,,,,,,,\n`),
      filename: 'comma-only.csv',
      source: 'minsa_dengue',
    })

    expect(result.rowsIn).toBe(1)
    expect(result.rowsValid).toBe(0)
    expect(result.rowsDropped).toBe(1)
    expect(result.status).toBe('ok_with_issues')
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'missing_ubigeo',
      'invalid_year',
      'invalid_epi_week',
      'missing_cases',
    ])
  })
})

describe('line lists with dates and a combined location', () => {
  const DISCHARGES = [
    'Id;sexo;edad;tipoedad;fecing;fecegr;PROCEDENCIA;FECHA_CORTE',
    'AAA1;FEMENINO;11;AÑOS;14/07/2026;16/07/2026;LIMA-LIMA-SANTA ANITA;13/11/2026',
    'AAA2;MASCULINO;10;DIAS;18/07/2026;20/07/2026;PROVINCIAS DE LIMA-HUARAL-HUARAL;13/11/2026',
    'AAA3;FEMENINO;3;AÑOS;19/07/2026;22/07/2026;HUANUCO-LEONCIO PRADO-RUPA-RUPA;13/11/2026',
    'AAA4;FEMENINO;5;AÑOS;sin fecha;22/07/2026;DEL CALLAO-CALLAO-CALLAO;13/11/2026',
    'AAA5;MASCULINO;7;AÑOS;20/07/2026;22/07/2026;;13/11/2026',
  ].join('\r\n')

  // Codifica el listado en latin1, como lo exportan los sistemas hospitalarios
  function discharges(): Buffer {
    return Buffer.from(DISCHARGES, 'latin1')
  }

  it('suggests the admission date and the combined location from the rules alone', async () => {
    const preview = await previewUpload({
      data: discharges(),
      filename: 'egresos.csv',
      source: 'minsa_dengue',
    })
    const roles = Object.fromEntries(
      preview.columns.map((column) => [
        column.name,
        [column.role, column.level ?? column.field ?? column.kind],
      ]),
    )
    expect(roles).toEqual({
      Id: ['identifier', 'text'],
      sexo: ['category', 'sex'],
      edad: ['measure', 'age_group'],
      tipoedad: ['category', 'age_type'],
      fecing: ['date', 'date'],
      fecegr: ['ignore', 'date'],
      PROCEDENCIA: ['place', 'location'],
      FECHA_CORTE: ['ignore', 'date'],
    })
    expect(preview.columns.find((column) => column.name === 'tipoedad')?.samples).toEqual([
      'AÑOS',
      'DIAS',
    ])
  })

  it('derives the epidemiological week, the department and the age band', async () => {
    const result = await ingestUpload({
      data: discharges(),
      filename: 'egresos.csv',
      source: 'minsa_dengue',
      mappingOverride: {
        event_date: 'fecing',
        location: 'PROCEDENCIA',
        sex: 'sexo',
        age_group: 'edad',
        age_type: 'tipoedad',
      },
    })

    expect(result.rowsIn).toBe(5)
    expect(result.rowsValid).toBe(3)
    expect(result.issues.map((issue) => [issue.code, issue.count])).toEqual([
      ['invalid_event_date', 1],
      ['missing_location', 1],
    ])
    expect(
      result.rows.map((row) => [
        row.year,
        row.epi_week,
        row.department,
        row.district,
        row.age_group,
      ]),
    ).toEqual([
      [2026, 28, 'LIMA', 'SANTA ANITA', '10-19'],
      [2026, 28, 'LIMA', 'HUARAL', '<1'],
      [2026, 29, 'HUANUCO', 'RUPA-RUPA', '1-4'],
    ])
    expect(result.rows.every((row) => row.cases === 1 && row.disease === 'DENGUE')).toBe(true)
  })

  it('shares only safe samples with the AI and lets it lead the mapping', async () => {
    let shared: Array<{ name: string; samples: string[] }> = []
    const preview = await previewUpload(
      { data: discharges(), filename: 'egresos.csv', source: 'minsa_dengue' },
      (input) => {
        shared = input.columns
        return Promise.resolve({
          title: 'Egresos hospitalarios 2026',
          topic: 'egresos hospitalarios',
          columns: [
            {
              column: 'fecegr',
              label: 'Fecha de egreso',
              role: 'ignore',
              level: null,
              field: null,
              reason: null,
            },
            {
              column: 'fecing',
              label: 'Fecha de ingreso',
              role: 'date',
              level: null,
              field: null,
              reason: 'Es la fecha más cercana al inicio del caso.',
            },
          ],
        })
      },
    )

    expect(shared.find((column) => column.name === 'Id')?.samples).toEqual([])
    expect(shared.find((column) => column.name === 'fecing')?.samples).toHaveLength(3)
    expect(preview.suggested_by).toBe('deepseek')
    expect(preview.title).toBe('Egresos hospitalarios 2026')
    expect(preview.topic).toBe('egresos hospitalarios')
    expect(preview.columns.find((column) => column.name === 'fecing')).toMatchObject({
      label: 'Fecha de ingreso',
      role: 'date',
      reason: 'Es la fecha más cercana al inicio del caso.',
    })
    expect(preview.columns.find((column) => column.name === 'PROCEDENCIA')).toMatchObject({
      role: 'place',
      level: 'location',
    })
  })

  it('does not share unique numeric codes such as record numbers with the AI', async () => {
    let shared: Array<{ name: string; samples: string[] }> = []
    const rows = Array.from({ length: 6 }, (_, index) => `${48213 + index * 7},2024,1,LIMA`)
    await previewUpload(
      {
        data: Buffer.from(`nro_registro,ano,semana,departamento\n${rows.join('\n')}\n`),
        filename: 'registros.csv',
        source: 'minsa_dengue',
      },
      (input) => {
        shared = input.columns
        return Promise.resolve(null)
      },
    )
    expect(shared.find((column) => column.name === 'nro_registro')?.samples).toEqual([])
    expect(shared.find((column) => column.name === 'departamento')?.samples).toEqual(['LIMA'])
  })

  it('envía a la IA solo las columnas que no son datos personales', async () => {
    let shared: string[] = []
    const preview = await previewUpload(
      {
        data: Buffer.from('dni,ano,semana,departamento\n123,2024,1,LIMA\n'),
        filename: 'pii.csv',
        source: 'minsa_dengue',
      },
      (input) => {
        shared = input.columns.map((column) => column.name)
        return Promise.resolve(null)
      },
    )
    expect(shared).toEqual(['ano', 'semana', 'departamento'])
    expect(preview.pii_detected).toEqual(['dni'])
    expect(preview.columns.find((column) => column.name === 'dni')).toMatchObject({
      role: 'identifier',
      reason: 'Dato personal: se acepta, pero no se guarda ni se envía a la IA.',
    })
  })

  it('suggests roles for an anemia file without dates or counts', async () => {
    const rows = [
      'distrito;sexo;edad_meses;hemoglobina;anemia',
      'HUANCAYO;F;12;11,2;NO',
      'HUANCAYO;M;18;10,1;SI',
      'CHILCA;F;24;9,8;SI',
      'CHILCA;M;9;12,0;NO',
      'EL TAMBO;F;30;10,9;SI',
      'EL TAMBO;M;14;11,5;NO',
    ]
    const preview = await previewUpload({
      data: Buffer.from(rows.join('\n')),
      filename: 'anemia_junin.csv',
      source: 'minsa_dengue',
    })
    const roles = Object.fromEntries(preview.columns.map((column) => [column.name, column.role]))
    expect(roles).toMatchObject({
      distrito: 'place',
      sexo: 'category',
      hemoglobina: 'measure',
      anemia: 'category',
    })
    expect(preview.columns.find((column) => column.name === 'hemoglobina')?.kind).toBe('number')
    expect(preview.title).toBe('anemia_junin')
  })

  it('elige como fecha principal la más cercana al inicio del caso, no la de corte', async () => {
    const rows = [
      'FECHA_CORTE,FECHA_INICIO_SINTOMAS,FECHA_ALTA,DEPARTAMENTO',
      '20260630,20260427,20260502,PIURA',
      '20260701,20260620,20260625,LIMA',
      '20260702,20260621,20260628,ICA',
    ]
    const preview = await previewUpload({
      data: Buffer.from(rows.join('\n')),
      filename: 'fechas.csv',
      source: 'minsa_dengue',
    })
    const roles = Object.fromEntries(preview.columns.map((column) => [column.name, column.role]))
    expect(roles).toEqual({
      FECHA_CORTE: 'ignore',
      FECHA_INICIO_SINTOMAS: 'date',
      FECHA_ALTA: 'ignore',
      DEPARTAMENTO: 'place',
    })
  })

  it('sin alias prefiere fechas de toma o atención sobre las de egreso', async () => {
    const rows = [
      'fecha_egreso;fecha_toma;distrito',
      '02/07/2026;01/07/2026;ATE',
      '05/07/2026;03/07/2026;ATE',
    ]
    const preview = await previewUpload({
      data: Buffer.from(rows.join('\n')),
      filename: 'tomas.csv',
      source: 'minsa_dengue',
    })
    const roles = Object.fromEntries(preview.columns.map((column) => [column.name, column.role]))
    expect(roles).toMatchObject({ fecha_egreso: 'ignore', fecha_toma: 'date' })

    const dengue = await previewUpload({
      data: Buffer.from(
        'FECHA_INGRESO;FECHA_INICIO_SINTOMAS;DISTRITO\n20260630;20260427;ATE\n20260701;20260620;ATE\n',
      ),
      filename: 'dengue.csv',
      source: 'minsa_dengue',
    })
    expect(dengue.columns.map((column) => column.role)).toEqual(['ignore', 'date', 'place'])
  })

  it('accepts a department without UBIGEO', async () => {
    const result = await ingestUpload({
      data: Buffer.from('departamento,ano,semana,casos\nLORETO,2024,1,2\n'),
      filename: 'sin-ubigeo.csv',
      source: 'minsa_dengue',
    })
    expect(result.rowsValid).toBe(1)
    expect(result.rows[0]).toMatchObject({ department: 'LORETO', ubigeo: '', cases: 2 })
  })
})

describe('códigos numéricos', () => {
  it('nunca sugiere un código como valor medido aunque la IA lo diga', async () => {
    const lines = ['CODIGO_RED;MICRORED;ESTADO;edad']
    for (let index = 0; index < 30; index += 1) {
      lines.push(
        `${(index % 9) + 1};${index % 8};${index % 2 ? 'ACTIVO' : 'CERRADO'};${20 + index}`,
      )
    }
    const preview = await previewUpload(
      { data: Buffer.from(lines.join('\n')), filename: 'eess.csv', source: 'minsa_dengue' },
      () =>
        Promise.resolve({
          title: 'Establecimientos',
          topic: 'establecimientos',
          columns: [
            {
              column: 'CODIGO_RED',
              label: 'Código de red',
              role: 'measure',
              level: null,
              field: null,
              reason: 'x',
            },
            {
              column: 'MICRORED',
              label: 'Código de microrred',
              role: 'measure',
              level: null,
              field: null,
              reason: 'x',
            },
            {
              column: 'edad',
              label: 'Edad',
              role: 'measure',
              level: null,
              field: null,
              reason: 'x',
            },
          ],
        }),
    )
    const roles = Object.fromEntries(preview.columns.map((column) => [column.name, column.role]))
    expect(roles).toMatchObject({ CODIGO_RED: 'category', MICRORED: 'category', edad: 'measure' })
  })
})

describe('nombres y roles sugeridos', () => {
  const lines = ['HV000;HV001;HV002;HV025']
  for (let index = 0; index < 30; index += 1) {
    lines.push(`PE6;${(index % 9) + 1};${10 + index};${(index % 2) + 1}`)
  }
  const data = Buffer.from(lines.join('\n'))

  // Respuesta simulada de la IA con un nombre repetido y una columna marcada como identificador
  const suggest = () =>
    Promise.resolve({
      title: 'Hogares',
      topic: 'vivienda',
      columns: [
        {
          column: 'HV000',
          label: 'Código de país',
          role: 'ignore' as const,
          level: null,
          field: null,
          reason: null,
        },
        {
          column: 'HV001',
          label: 'Conglomerado',
          role: 'identifier' as const,
          level: null,
          field: null,
          reason: 'Código de conglomerado.',
        },
        {
          column: 'HV002',
          label: 'Número de hogar',
          role: 'measure' as const,
          level: null,
          field: null,
          reason: 'x',
        },
        {
          column: 'HV025',
          label: 'Número de hogar',
          role: 'category' as const,
          level: null,
          field: null,
          reason: 'x',
        },
      ],
    })

  it('respeta a la IA cuando la regla solo se basa en el perfil de la columna', async () => {
    const preview = await previewUpload(
      { data, filename: 'rech0.csv', source: 'minsa_dengue' },
      suggest,
    )
    expect(preview.columns.find((column) => column.name === 'HV001')).toMatchObject({
      role: 'identifier',
      reason: 'Código de conglomerado.',
    })
  })

  it('no repite nombres de columna', async () => {
    const preview = await previewUpload(
      { data, filename: 'rech0.csv', source: 'minsa_dengue' },
      suggest,
    )
    const labels = preview.columns.map((column) => column.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toContain('Número de hogar (HV025)')
  })

  it('explica por qué una columna con un solo valor no se usa', async () => {
    const preview = await previewUpload(
      { data, filename: 'rech0.csv', source: 'minsa_dengue' },
      suggest,
    )
    expect(preview.columns.find((column) => column.name === 'HV000')?.reason).toBe(
      'Tiene el mismo valor en todas las filas, así que no aporta al análisis.',
    )
  })
})

describe('roles de tiempo', () => {
  it('no acepta como mes una columna cuyos valores no están entre 1 y 12', async () => {
    const lines = ['HV007;HV008;HV025']
    for (let index = 0; index < 20; index += 1) {
      lines.push(`2020;${1440 + index};${(index % 2) + 1}`)
    }
    const preview = await previewUpload(
      { data: Buffer.from(lines.join('\n')), filename: 'rech0.csv', source: 'minsa_dengue' },
      () =>
        Promise.resolve({
          title: 'Hogares',
          topic: 'vivienda',
          columns: [
            {
              column: 'HV007',
              label: 'Año de entrevista',
              role: 'year' as const,
              level: null,
              field: null,
              reason: 'x',
            },
            {
              column: 'HV008',
              label: 'Mes de entrevista',
              role: 'month' as const,
              level: null,
              field: null,
              reason: 'x',
            },
            {
              column: 'HV025',
              label: 'Área',
              role: 'category' as const,
              level: null,
              field: null,
              reason: 'x',
            },
          ],
        }),
    )
    const hv008 = preview.columns.find((column) => column.name === 'HV008')
    expect(hv008?.role).toBe('ignore')
    expect(hv008?.reason).toBe('Sus valores no están en el rango de un mes (1 a 12).')
    expect(preview.columns.find((column) => column.name === 'HV007')?.role).toBe('year')
  })
})

describe('columnas constantes', () => {
  it('no usa categorías constantes pero conserva un lugar constante', async () => {
    const lines = ['DEPARTAMENTO;SELECCION;sexo']
    for (let index = 0; index < 10; index += 1) {
      lines.push(`PIURA;1;${index % 2 ? 'F' : 'M'}`)
    }
    const preview = await previewUpload(
      { data: Buffer.from(lines.join('\n')), filename: 'piura.csv', source: 'minsa_dengue' },
      () =>
        Promise.resolve({
          title: 'Piura',
          topic: 'dengue',
          columns: [
            {
              column: 'DEPARTAMENTO',
              label: 'Departamento',
              role: 'place' as const,
              level: 'department' as const,
              field: null,
              reason: 'x',
            },
            {
              column: 'SELECCION',
              label: 'Selección',
              role: 'category' as const,
              level: null,
              field: null,
              reason: 'x',
            },
            {
              column: 'sexo',
              label: 'Sexo',
              role: 'category' as const,
              level: null,
              field: null,
              reason: 'x',
            },
          ],
        }),
    )
    const byName = Object.fromEntries(preview.columns.map((column) => [column.name, column]))
    expect(byName.SELECCION).toMatchObject({ role: 'ignore' })
    expect(byName.DEPARTAMENTO).toMatchObject({
      role: 'place',
      reason: 'Todas las filas tienen el mismo valor.',
    })
    expect(byName.sexo?.role).toBe('category')
  })
})
