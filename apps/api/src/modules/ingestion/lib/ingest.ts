import { basename, extname } from 'node:path'

import type { DatasetColumnDto, UploadPreview } from '@vigia/contracts'
import {
  PLACE_LEVEL_INFO,
  ROLE_INFO,
  MAX_EPI_WEEK,
  MAX_YEAR,
  MIN_EPI_WEEK,
  MIN_YEAR,
  codedValues,
  isMappingTarget,
  parseNumber,
  sanitizeValueLabels,
  valueRules,
  toEpiMapping,
  type ColumnKind,
  validateColumns,
  type DatasetColumn,
  type UbigeoLevel,
} from '@vigia/epidemiology'

import type { ColumnSample, DatasetSuggestion, SuggestColumns } from './columns'
import { NoUsefulColumns } from './errors'
import type { QualityIssue } from './quality'
import {
  findPii,
  loadSourceConfig,
  mappingResult,
  resolveMapping,
  normalizeHeader,
  resolveMappingOverride,
  type SourceConfig,
} from './mapping'
import type { RawTable } from './readers'
import { normalize, type CanonicalRow } from './normalize'
import { fileSha256, readTable } from './readers'
import {
  codeCategoryReasons,
  demoteCodes,
  isFreeText,
  placeCodeLevel,
  profileColumn,
  ruleSuggestion,
  type ColumnProfile,
} from './profile'
import { inferTopic } from './topic'
import { typedRows, type TypedValue } from './typed-rows'

export interface IngestRequest {
  data: Buffer
  filename: string
  source: string
  mappingOverride?: Record<string, string>
  columns?: DatasetColumn[]
  title?: string
  topic?: string
}

export interface IngestResult {
  fileHash: string
  status: 'ok' | 'ok_with_issues'
  rowsIn: number
  rowsValid: number
  rowsDropped: number
  duplicatesCollapsed: number
  mapping: Record<string, string>
  unmappedColumns: string[]
  issues: QualityIssue[]
  rows: CanonicalRow[]
  sourceFormat: 'csv' | 'xlsx'
  encoding: string | null
  delimiter: string | null
  title: string
  topic: string
  columns: DatasetColumn[]
  epi: boolean
  genericRows: Record<string, TypedValue>[]
}

const UNTITLED_TOPIC = 'SIN TEMA'
const MIN_TIME_RATIO = 0.9
const COUNT_REASON = 'Número entero que suma casos; se usará como cantidad.'
const MEASURE_REASON = 'Número que varía entre filas; se usará como valor medido.'
const FREE_TEXT_REASON = 'Texto libre; no se usa en el tablero.'
const CONSTANT_PLACE_REASON = 'Mismo valor en todas las filas; se conserva como lugar del archivo.'
const REPEATED_REASON = 'Ya hay otra columna con este uso, así que no se usará.'
const PERSONAL_DATA_REASON = 'Dato personal: se acepta, pero no se guarda ni se envía a la IA.'
const TIME_RULES: Partial<
  Record<DatasetColumn['role'], { min: number; max: number; reason: string }>
> = {
  year: { min: MIN_YEAR, max: MAX_YEAR, reason: 'Sus valores no son años válidos.' },
  week: {
    min: MIN_EPI_WEEK,
    max: MAX_EPI_WEEK,
    reason: 'Sus valores no están en el rango de una semana epidemiológica (1 a 53).',
  },
  month: { min: 1, max: 12, reason: 'Sus valores no están en el rango de un mes (1 a 12).' },
}
const CODE_LEVEL_NAMES: Readonly<Record<UbigeoLevel, string>> = {
  department: 'departamento',
  province: 'provincia',
  district: 'distrito',
}
const SAMPLE_SIZE = 3
const MAX_LABELED_VALUES = 50
const NO_CODE_ROLES: ReadonlySet<DatasetColumn['role']> = new Set([
  'date',
  'year',
  'week',
  'month',
  'place',
  'count',
])
const PROFILE_ROWS = 2000
const MAX_SHARED_DISTINCT_RATIO = 0.5
const MIN_DATE_RATIO = 0.75
const DATE_LIKE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}(?:[T\s].*)?$|^(?:19|20)\d{6}$/
const DATE_TIERS: readonly [RegExp, number][] = [
  [/inicio|sintoma/, 3],
  [/notific|toma|muestra|captacion/, 2],
  [/ingreso|atencion|consulta/, 1],
]
const DISCARDED_DATE = /corte|egreso|alta|actualiz|registro|carga|proceso|defuncion/

// Valida un archivo, guarda sus filas genéricas y, si tiene tiempo y lugar, la capa epidemiológica
export async function ingestUpload(request: IngestRequest): Promise<IngestResult> {
  const fileHash = fileSha256(request.data)
  const config = loadSourceConfig(request.source)
  const table = await readTable(request.data, request.filename)

  const pii = findPii(table.columns, config)
  const columns = uniqueLabels(
    usableColumns(
      protectPersonalData(
        request.columns ? reviewedColumns(table, request.columns) : tableRules(table, config),
        pii,
      ),
    ),
  )
  const mapping = request.mappingOverride
    ? resolveMappingOverride(table.columns, request.mappingOverride)
    : mappingResult(table.columns, toEpiMapping(columns))
  const epi = mapping.missingRequired.length === 0
  const topic = request.topic ?? config.disease.toLowerCase()
  const disease = topic.trim().toUpperCase() || UNTITLED_TOPIC
  const normalized = epi ? normalize(table.rows, mapping, { ...config, disease }) : null
  const genericRows = typedRows(table.rows, columns)

  return {
    fileHash,
    status: normalized && normalized.issues.length > 0 ? 'ok_with_issues' : 'ok',
    rowsIn: table.rows.length,
    rowsValid: normalized ? normalized.rows.length : genericRows.length,
    rowsDropped: normalized?.rowsDropped ?? 0,
    duplicatesCollapsed: normalized?.duplicatesCollapsed ?? 0,
    mapping: mapping.mapping,
    unmappedColumns: mapping.unmappedColumns,
    issues: normalized?.issues ?? [],
    rows: normalized?.rows ?? [],
    sourceFormat: table.sourceFormat,
    encoding: table.encoding,
    delimiter: table.delimiter,
    title: request.title?.trim() || basename(request.filename, extname(request.filename)),
    topic: topic.trim().toLowerCase(),
    columns,
    epi,
    genericRows,
  }
}

// Sugiere los roles de todas las columnas de la tabla usando solo reglas
function tableRules(table: RawTable, config: SourceConfig): DatasetColumn[] {
  return columnsFromMapping(table, resolveMapping(table.columns, config).mapping)
}

// Deriva los roles de la tabla a partir de un mapeo campo → columna y del perfil de cada columna
export function columnsFromMapping(
  table: RawTable,
  aliasMapping: Record<string, string>,
): DatasetColumn[] {
  const profiles = new Map(
    table.columns.map((name) => [name, profileColumn(table.rows.map((row) => row[name] ?? ''))]),
  )
  return ruleColumns(table.columns, profiles, aliasMapping, codeLevels(table))
}

// Columnas de la tabla que guardan códigos UBIGEO, con el nivel de lugar de cada una
function codeLevels(table: RawTable): Map<string, UbigeoLevel> {
  const levels = new Map<string, UbigeoLevel>()
  for (const name of table.columns) {
    const level = placeCodeLevel(
      name,
      table.rows.map((row) => row[name] ?? ''),
    )
    if (level) {
      levels.set(name, level)
    }
  }
  return levels
}

// Motivo para no usar un código de lugar cuando otra columna del mismo nivel trae los nombres
function nameReasons(
  columns: readonly DatasetColumn[],
  codes: ReadonlyMap<string, UbigeoLevel>,
): Map<string, string> {
  const reasons = new Map<string, string>()
  for (const column of columns) {
    const named = columns.find(
      (other) => other.role === 'place' && other.level === column.level && !codes.has(other.name),
    )
    if (column.role === 'place' && codes.has(column.name) && named) {
      const label = named.label.trim() || named.name
      reasons.set(column.name, `Se usa la columna «${label}» con los nombres; este es su código.`)
    }
  }
  return reasons
}

// Valores distintos y no vacíos de una columna de la tabla
function distinctValues(table: RawTable, name: string): string[] {
  return [...new Set(table.rows.map((row) => (row[name] ?? '').trim()))].filter((v) => v !== '')
}

// Deja el significado de los valores solo en categorías, con códigos que existen y no son "Sin dato"
function withValueLabels(column: DatasetColumn, table: RawTable): DatasetColumn {
  const { values: raw, ...rest } = column
  if (column.role !== 'category' || raw === undefined) {
    return rest
  }
  const distinct = distinctValues(table, column.name)
  const missing = valueRules(column.name, distinct).missing
  const values =
    distinct.length > MAX_LABELED_VALUES
      ? undefined
      : sanitizeValueLabels(
          raw,
          distinct.filter((value) => !missing.has(value)),
        )
  return values ? { ...rest, values } : rest
}

// Toma los roles confirmados por el usuario para columnas reales; las que faltan quedan sin uso
function reviewedColumns(table: RawTable, reviewed: readonly DatasetColumn[]): DatasetColumn[] {
  const byName = new Map(reviewed.map((column) => [column.name, column]))
  return table.columns.map((name) => {
    const column = byName.get(name)
    return column
      ? withValueLabels(column, table)
      : { name, label: '', role: 'ignore', level: null, field: null, kind: 'text' }
  })
}

// Aplica las reglas de unicidad y rechaza el archivo si ninguna columna sirve
function usableColumns(columns: DatasetColumn[]): DatasetColumn[] {
  try {
    return validateColumns(columns)
  } catch {
    throw new NoUsefulColumns()
  }
}

// Muestra cómo se leería el archivo: columnas reales, ejemplos y el rol sugerido de cada una
export async function previewUpload(
  request: Pick<IngestRequest, 'data' | 'filename' | 'source'>,
  suggest?: SuggestColumns,
): Promise<UploadPreview> {
  const config = loadSourceConfig(request.source)
  const table = await readTable(request.data, request.filename)
  const pii = findPii(table.columns, config)
  const rules = tableRules(table, config)
  const samples = columnSamples(table, new Map(rules.map((column) => [column.name, column.kind])))

  const codeLevelsByName = codeLevels(table)
  const codes = new Map(
    rules
      .filter(
        (column) =>
          !pii.includes(column.name) &&
          !codeLevelsByName.has(column.name) &&
          !NO_CODE_ROLES.has(column.role),
      )
      .map((column) => [column.name, codedValues(column.name, distinctValues(table, column.name))])
      .filter((entry): entry is [string, string[]] => (entry[1] as string[]).length > 0),
  )
  const shared = samples
    .filter((column) => !pii.includes(column.name))
    .map((column) => ({
      ...column,
      samples: sharedSamples(table, column),
      ...(codes.has(column.name) ? { codes: codes.get(column.name) } : {}),
    }))
  const ai = suggest ? await suggest({ filename: request.filename, columns: shared }) : null

  const distinct = new Map(
    table.columns.map((name) => [
      name,
      new Set(table.rows.map((row) => (row[name] ?? '').trim()).filter((value) => value !== ''))
        .size,
    ]),
  )
  const freeText = new Set(
    table.columns.filter((name) =>
      isFreeText(profileColumn(table.rows.map((row) => row[name] ?? ''))),
    ),
  )
  const aliasNames = new Set(Object.values(resolveMapping(table.columns, config).mapping))
  const suggested = mergeSuggestions(rules, ai, aliasNames, codeLevels(table))
  const timeChecked = checkTimeRanges(
    suggested.map((item) => item.column),
    table,
    rules,
  )
  const corrected = uniqueLabels(
    demoteCodes(
      timeChecked.map((item) => item.column),
      distinct,
    ),
  )
  const merged = suggested.map((item, index) => {
    const candidate = corrected[index] ?? item.column
    const constant = (distinct.get(candidate.name) ?? 0) <= 1
    const descriptive =
      (candidate.role === 'category' || candidate.role === 'measure') && candidate.field === null
    const column: DatasetColumn = withPreviewValues(
      constant && descriptive
        ? { ...candidate, role: 'ignore', level: null, field: null }
        : candidate,
      codes.get(candidate.name),
    )
    const timeReason = timeChecked[index]?.reason ?? null
    const reason = constant
      ? column.role === 'ignore' || column.role === 'identifier'
        ? 'Tiene el mismo valor en todas las filas, así que no aporta al análisis.'
        : column.role === 'place'
          ? CONSTANT_PLACE_REASON
          : 'Todas las filas tienen el mismo valor.'
      : timeReason
        ? timeReason
        : column.role === 'ignore' && freeText.has(column.name)
          ? FREE_TEXT_REASON
          : column.role === item.column.role
            ? item.reason
            : 'Es un código, no una medida.'
    return pii.includes(column.name)
      ? {
          column: {
            ...column,
            label: column.label || 'Dato personal',
            role: 'identifier' as const,
            level: null,
            field: null,
          },
          reason: PERSONAL_DATA_REASON,
        }
      : { column, reason }
  })
  return {
    source: request.source,
    title: ai?.title ?? basename(request.filename, extname(request.filename)),
    topic: ai?.topic ?? inferTopic(request.filename, request.source, toEpiMapping(rules)),
    rows: table.rows.length,
    suggested_by: ai ? 'deepseek' : 'rules',
    columns: merged.map(({ column, reason }) => ({
      ...column,
      samples: samples.find((sample) => sample.name === column.name)?.samples ?? [],
      ...(codes.has(column.name) ? { codes: codes.get(column.name) } : {}),
      reason,
    })),
    roles: ROLE_INFO.map((role) => ({ ...role })),
    place_levels: PLACE_LEVEL_INFO.map((level) => ({ ...level })),
    pii_detected: pii,
  }
}

// Conserva el significado de los valores solo en categorías y solo para códigos reales de la columna
function withPreviewValues(column: DatasetColumn, codes: readonly string[] | undefined) {
  const { values: raw, ...rest } = column
  const values = column.role === 'category' ? sanitizeValueLabels(raw, codes ?? []) : undefined
  return values ? { ...rest, values } : rest
}

// Sugiere el rol de cada columna solo con reglas: alias conocidos, encabezados y perfil
export function ruleColumns(
  names: readonly string[],
  profiles: ReadonlyMap<string, ColumnProfile>,
  aliasMapping: Record<string, string>,
  codes: ReadonlyMap<string, UbigeoLevel> = new Map(),
): DatasetColumn[] {
  const aliasOf = new Map(Object.entries(aliasMapping).map(([target, name]) => [name, target]))
  const columns = names.map((name): DatasetColumn => {
    const profile = profiles.get(name) ?? profileColumn([])
    const alias = aliasOf.get(name)
    return {
      name,
      label: '',
      kind: profile.kind,
      ...ruleSuggestion(
        name,
        profile,
        alias && isMappingTarget(alias) ? alias : null,
        codes.get(name) ?? null,
      ),
    }
  })
  const main = mainDate(columns, aliasOf)
  const named = nameReasons(columns, codes)
  return columns.map((column) =>
    (column.role === 'date' && column.name !== main) || named.has(column.name)
      ? { ...column, role: 'ignore', level: null }
      : column,
  )
}

// Elige la fecha principal: la conocida por alias o la más cercana al inicio del caso, nunca corte o egreso
function mainDate(
  columns: readonly DatasetColumn[],
  aliasOf: ReadonlyMap<string, string>,
): string | null {
  const score = (name: string) => {
    const key = normalizeHeader(name)
    return (
      (aliasOf.get(name) === 'event_date' ? 5 : 0) +
      (DATE_TIERS.find(([pattern]) => pattern.test(key))?.[1] ?? 0) -
      (DISCARDED_DATE.test(key) ? 3 : 0)
    )
  }
  const dates = columns.filter((column) => column.role === 'date')
  return (
    dates.reduce<DatasetColumn | null>(
      (best, column) => (best === null || score(column.name) > score(best.name) ? column : best),
      null,
    )?.name ?? null
  )
}

// Toma hasta tres valores distintos y no vacíos de cada columna como ejemplo
function columnSamples(table: RawTable, kinds: ReadonlyMap<string, ColumnKind>): ColumnSample[] {
  return table.columns.map((name) => {
    const samples: string[] = []
    for (const row of table.rows) {
      const value = (row[name] ?? '').trim()
      if (value !== '' && !samples.includes(value)) {
        samples.push(value)
      }
      if (samples.length === SAMPLE_SIZE) {
        break
      }
    }
    return { name, samples, kind: kinds.get(name) ?? 'text' }
  })
}

// Ejemplos que pueden enviarse a la IA: fechas, o valores que se repiten mucho (no identifican personas)
function sharedSamples(table: RawTable, column: ColumnSample): string[] {
  const values = table.rows
    .slice(0, PROFILE_ROWS)
    .map((row) => (row[column.name] ?? '').trim())
    .filter((value) => value !== '')
  if (values.length === 0) {
    return []
  }
  const dates = values.filter((value) => DATE_LIKE.test(value))
  if (dates.length / values.length >= MIN_DATE_RATIO) {
    return [...new Set(dates)].slice(0, SAMPLE_SIZE)
  }
  return new Set(values).size / values.length <= MAX_SHARED_DISTINCT_RATIO ? column.samples : []
}

// Explica en una frase por qué la regla dejó usada una columna que la IA descartó
function ruleReason(role: DatasetColumn['role']): string | null {
  return role === 'count' ? COUNT_REASON : role === 'measure' ? MEASURE_REASON : null
}

// Combina la IA con las reglas: la IA manda, salvo si descarta un número útil
export function mergeSuggestions(
  rules: readonly DatasetColumn[],
  ai: DatasetSuggestion | null,
  aliasNames: ReadonlySet<string> = new Set(),
  codes: ReadonlyMap<string, UbigeoLevel> = new Map(),
): { column: DatasetColumnDto; reason: string | null }[] {
  const byColumn = new Map((ai?.columns ?? []).map((item) => [item.column, item]))
  const reviewed = rules.map((rule) => {
    const suggestion = byColumn.get(rule.name)
    const unused = !suggestion || suggestion.role === 'ignore' || suggestion.role === 'identifier'
    const known = aliasNames.has(rule.name)
    const ruleUsed = rule.role !== 'ignore' && rule.role !== 'identifier'
    const numericIgnored = suggestion?.role === 'ignore' && rule.kind === 'number' && ruleUsed
    const keepRule = !suggestion || (unused && known && ruleUsed) || numericIgnored
    const column: DatasetColumn = keepRule
      ? { ...rule, label: suggestion?.label ?? rule.label }
      : {
          ...rule,
          label: suggestion.label ?? '',
          role: suggestion.role,
          level: suggestion.level,
          field: suggestion.field,
          ...(suggestion.values ? { values: suggestion.values } : {}),
        }
    const reason = keepRule
      ? ai && ruleUsed
        ? known || !numericIgnored
          ? 'Coincide con un nombre de columna conocido.'
          : ruleReason(rule.role)
        : null
      : suggestion.reason
    return { column, reason }
  })
  const placed = withPlaceCodes(reviewed, codes)
  const codeOf = codeCategoryReasons(placed.map((item) => item.column))
  const merged = placed.map((item) => {
    const reason = codeOf.get(item.column.name)
    return reason
      ? { column: { ...item.column, role: 'ignore' as const, level: null, field: null }, reason }
      : item
  })
  const valid = safeValidate(merged.map((item) => item.column))
  return merged.map((item, index) => {
    const validated = valid[index] ?? item.column
    const rule = rules[index]
    const demoted = validated.role !== item.column.role
    // Un número repetido en un rol único vuelve a su rol de regla en lugar de perderse
    const rescued =
      demoted && validated.role === 'ignore' && rule?.kind === 'number'
        ? ruleReason(rule.role)
        : null
    if (rule && rescued) {
      return {
        column: { ...validated, role: rule.role, level: rule.level, field: rule.field },
        reason: rescued,
      }
    }
    return { column: validated, reason: demoted ? REPEATED_REASON : item.reason }
  })
}

// Fuerza los códigos de lugar a lugar (nunca categoría) y deja el lugar a la columna con los nombres
function withPlaceCodes(
  items: readonly { column: DatasetColumnDto; reason: string | null }[],
  codes: ReadonlyMap<string, UbigeoLevel>,
): { column: DatasetColumnDto; reason: string | null }[] {
  const forced = items.map((item) => {
    const level = codes.get(item.column.name)
    if (!level) {
      return item
    }
    const same = item.column.role === 'place' && item.column.level === level
    return same && item.reason
      ? item
      : {
          column: { ...item.column, role: 'place' as const, level, field: null },
          reason: `Código de ${CODE_LEVEL_NAMES[level]}; se muestra con el nombre del lugar.`,
        }
  })
  const named = nameReasons(
    forced.map((item) => item.column),
    codes,
  )
  return forced.map((item) => {
    const reason = named.get(item.column.name)
    return reason
      ? { column: { ...item.column, role: 'ignore' as const, level: null, field: null }, reason }
      : item
  })
}

const FALLBACK_ROLES: ReadonlySet<string> = new Set(['count', 'measure', 'category'])

// Cambia por la regla los roles de tiempo cuyos valores no caben en su rango (por ejemplo, 1446 como mes)
function checkTimeRanges(
  columns: readonly DatasetColumn[],
  table: RawTable,
  rules: readonly DatasetColumn[],
): { column: DatasetColumn; reason: string | null }[] {
  return columns.map((column) => {
    const rule = TIME_RULES[column.role]
    if (!rule) {
      return { column, reason: null }
    }
    const values = table.rows
      .slice(0, PROFILE_ROWS)
      .map((row) => parseNumber((row[column.name] ?? '').trim()))
      .filter((value): value is number => value !== null)
    const inside = values.filter((value) => value >= rule.min && value <= rule.max).length
    if (values.length > 0 && inside / values.length >= MIN_TIME_RATIO) {
      return { column, reason: null }
    }
    const fallback = rules.find((item) => item.name === column.name)
    const usable = fallback && !TIME_RULES[fallback.role] && FALLBACK_ROLES.has(fallback.role)
    return fallback && usable
      ? {
          column: { ...column, role: fallback.role, level: fallback.level, field: fallback.field },
          reason: ruleReason(fallback.role) ?? rule.reason,
        }
      : { column: { ...column, role: 'ignore', level: null, field: null }, reason: rule.reason }
  })
}

// Fuerza las columnas de datos personales a identificador: se aceptan, pero nunca se guardan
function protectPersonalData(columns: DatasetColumn[], pii: readonly string[]): DatasetColumn[] {
  return columns.map((column) =>
    pii.includes(column.name)
      ? { ...column, role: 'identifier', level: null, field: null }
      : column,
  )
}

// Evita nombres repetidos: a partir del segundo, agrega entre paréntesis el nombre original de la columna
export function uniqueLabels<T extends { name: string; label: string }>(
  columns: readonly T[],
): T[] {
  const seen = new Set<string>()
  return columns.map((column) => {
    const key = column.label.trim().toLowerCase()
    if (key === '') {
      return column
    }
    if (seen.has(key)) {
      return { ...column, label: `${column.label} (${column.name})` }
    }
    seen.add(key)
    return column
  })
}

// Aplica las reglas de unicidad sin fallar cuando no hay columnas útiles (el modal lo avisa)
function safeValidate(columns: DatasetColumn[]): DatasetColumn[] {
  try {
    return validateColumns(columns)
  } catch {
    return columns
  }
}
