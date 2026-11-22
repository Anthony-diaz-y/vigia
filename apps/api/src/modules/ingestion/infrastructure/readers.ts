import { createHash } from 'node:crypto'
import { extname } from 'node:path'

import { detect } from 'chardet'
import { parse } from 'csv-parse/sync'
import ExcelJS from 'exceljs'
import iconv from 'iconv-lite'

import { EmptyFile, FileTooLarge, UnsupportedFile } from '../domain/errors'

const MAX_BYTES = 50 * 1024 * 1024
const MAX_ROWS = 2_000_000
const MAX_COLUMNS = 200

const CSV_SUFFIXES = new Set(['.csv', '.txt'])
const XLSX_SUFFIXES = new Set(['.xlsx'])
const BLOCKED_SUFFIXES = new Set(['.xls', '.xlsb', '.xlsm', '.ods'])

const DELIMITERS = [',', ';', '\t', '|'] as const

export interface RawTable {
  columns: string[]
  rows: Record<string, string>[]
  sourceFormat: 'csv' | 'xlsx'
  encoding: string | null
  delimiter: string | null
  sizeBytes: number
}

// Calcula el hash SHA-256 en hexadecimal del contenido del archivo
export function fileSha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

// Lee un CSV o XLSX subido como tabla de texto, validando tamaño, filas y columnas
export async function readTable(data: Buffer, filename: string): Promise<RawTable> {
  const suffix = extname(filename).toLowerCase()

  if (BLOCKED_SUFFIXES.has(suffix)) {
    throw new UnsupportedFile(`unsupported format: ${suffix}`)
  }
  if (!CSV_SUFFIXES.has(suffix) && !XLSX_SUFFIXES.has(suffix)) {
    throw new UnsupportedFile(`unsupported format: ${suffix || '<no extension>'}`)
  }
  if (data.length > MAX_BYTES) {
    throw new FileTooLarge('file exceeds size budget', MAX_BYTES, data.length)
  }

  let table: Omit<RawTable, 'columns' | 'rows' | 'sizeBytes'>
  let rows: string[][]

  if (CSV_SUFFIXES.has(suffix)) {
    const decoded = decodeText(data)
    const delimiter = sniffDelimiter(decoded.text)
    rows = parseCsv(decoded.text, delimiter)
    table = {
      sourceFormat: 'csv',
      encoding: decoded.encoding,
      delimiter,
    }
  } else {
    rows = await readXlsxRows(data)
    table = {
      sourceFormat: 'xlsx',
      encoding: null,
      delimiter: null,
    }
  }

  if (rows.length === 0) {
    throw new EmptyFile()
  }

  const headers = cleanHeaders(rows[0] ?? [])
  if (headers.length > MAX_COLUMNS) {
    throw new FileTooLarge('file exceeds column budget', MAX_COLUMNS, headers.length)
  }
  const body = rows.slice(1)
  if (body.length > MAX_ROWS) {
    throw new FileTooLarge('file exceeds row budget', MAX_ROWS, body.length)
  }
  if (body.length === 0) {
    throw new EmptyFile()
  }

  return {
    ...table,
    columns: headers,
    rows: body.map((row) => rowToRecord(headers, row)),
    sizeBytes: data.length,
  }
}

// Convierte una fila en un objeto indexado por los encabezados
function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {}
  for (let index = 0; index < headers.length; index += 1) {
    record[headers[index] ?? `unnamed_${index}`] = row[index] ?? ''
  }
  return record
}

// Decodifica el archivo como UTF-8 o, si falla, con la codificación detectada
function decodeText(data: Buffer): { text: string; encoding: string } {
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(data)
    return { text: stripBom(decoded), encoding: 'utf-8-sig' }
  } catch {
    const detected = detect(data) ?? 'windows-1252'
    const encoding = normalizeEncoding(detected)
    return { text: iconv.decode(data, encoding), encoding }
  }
}

// Quita la marca BOM inicial del texto si existe
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

// Unifica los nombres de codificaciones latinas como cp1252
function normalizeEncoding(encoding: string): string {
  const normalized = encoding.trim().toLowerCase()
  if (
    normalized === 'ascii' ||
    normalized === 'iso-8859-1' ||
    normalized === 'windows-1252' ||
    normalized === 'cp1252'
  ) {
    return 'cp1252'
  }
  return normalized
}

// Elige el delimitador más frecuente en una muestra del texto
function sniffDelimiter(text: string): string {
  const sample = text.slice(0, 8192)
  let best = ','
  let bestCount = 0

  for (const candidate of DELIMITERS) {
    const count = countOutsideQuotes(sample, candidate)
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

// Cuenta las apariciones del delimitador fuera de comillas
function countOutsideQuotes(text: string, delimiter: string): number {
  let count = 0
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (!quoted && char === delimiter) {
      count += 1
    }
  }
  return count
}

// Parsea el CSV y rechaza filas con más campos que el encabezado
function parseCsv(text: string, delimiter: string): string[][] {
  try {
    const records = parse(text, {
      delimiter,
      columns: false,
      skip_empty_lines: true,
      relax_column_count: true,
      cast: false,
      trim: false,
      bom: false,
    }) as string[][]
    const width = records[0]?.length ?? 0
    for (let index = 1; index < records.length; index += 1) {
      if ((records[index]?.length ?? 0) > width) {
        throw new Error(`row ${index + 1} has more fields than the header`)
      }
    }
    return records
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new UnsupportedFile(`malformed csv: ${message}`)
  }
}

// Limpia los encabezados, nombra los vacíos y numera los duplicados
function cleanHeaders(header: string[]): string[] {
  const seen = new Map<string, number>()
  return header.map((value, index) => {
    const base = String(value ?? '').trim() || `Unnamed: ${index}`
    const count = seen.get(base)
    if (count === undefined) {
      seen.set(base, 0)
      return base
    }
    const next = count + 1
    seen.set(base, next)
    return `${base}__${next}`
  })
}

// Lee las filas no vacías de la primera hoja de un XLSX sin macros
async function readXlsxRows(data: Buffer): Promise<string[][]> {
  if (data.includes(Buffer.from('vbaProject.bin'))) {
    throw new UnsupportedFile('macro-enabled workbook rejected')
  }

  const workbook = new ExcelJS.Workbook()
  try {
    const arrayBuffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer
    await workbook.xlsx.load(arrayBuffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new UnsupportedFile(`unreadable workbook: ${message}`)
  }

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new EmptyFile()
  }

  const columnCount = worksheet.columnCount
  if (columnCount === 0) {
    throw new EmptyFile()
  }

  const rows: string[][] = []
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const values: string[] = []
    for (let column = 1; column <= columnCount; column += 1) {
      values.push(cellToString(row.getCell(column).value))
    }
    if (rowNumber === 1 || values.some((value) => value !== '')) {
      rows.push(values)
    }
  }
  return rows
}

// Convierte el valor de una celda de Excel a texto
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'object') {
    if ('result' in value) {
      const result = value.result
      return result === null || result === undefined ? '' : String(result)
    }
    if ('text' in value) {
      return String(value.text)
    }
    if ('richText' in value) {
      return value.richText.map((part) => part.text).join('')
    }
  }
  return String(value)
}
