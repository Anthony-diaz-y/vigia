import { CANONICAL_COLUMNS } from '@vigia/epidemiology'

import { MissingRequiredColumns } from '../domain/errors'
import type { QualityIssue } from '../domain/quality'
import {
  detectPii,
  findPii,
  loadSourceConfig,
  resolveMapping,
  resolveMappingOverride,
} from '../infrastructure/mapping'
import { normalize, type CanonicalRow } from '../infrastructure/normalize'
import { fileSha256, readTable } from '../infrastructure/readers'

export interface IngestRequest {
  data: Buffer
  filename: string
  source: string
  mappingOverride?: Record<string, string>
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
}

export interface PreviewResult {
  source: string
  columns: string[]
  mapping: Record<string, string>
  unmapped_columns: string[]
  missing_required: string[]
  pii_detected: string[]
  canonical_columns: string[]
  required: string[]
}

/** Validate one upload and materialize the canonical rows in memory. */
export async function ingestUpload(request: IngestRequest): Promise<IngestResult> {
  const fileHash = fileSha256(request.data)
  const config = loadSourceConfig(request.source)
  const table = await readTable(request.data, request.filename)

  detectPii(table.columns, config)

  const mapping = request.mappingOverride
    ? resolveMappingOverride(table.columns, config, request.mappingOverride)
    : resolveMapping(table.columns, config)
  if (mapping.missingRequired.length > 0) {
    throw new MissingRequiredColumns(mapping.missingRequired, table.columns)
  }

  const normalized = normalize(table.rows, mapping, config)
  return {
    fileHash,
    status: normalized.issues.length === 0 ? 'ok' : 'ok_with_issues',
    rowsIn: table.rows.length,
    rowsValid: normalized.rows.length,
    rowsDropped: normalized.rowsDropped,
    duplicatesCollapsed: normalized.duplicatesCollapsed,
    mapping: mapping.mapping,
    unmappedColumns: mapping.unmappedColumns,
    issues: normalized.issues,
    rows: normalized.rows,
    sourceFormat: table.sourceFormat,
    encoding: table.encoding,
    delimiter: table.delimiter,
  }
}

/** Preview the mapping for a file without ingesting it. */
export async function previewUpload(
  request: Pick<IngestRequest, 'data' | 'filename' | 'source'>,
): Promise<PreviewResult> {
  const config = loadSourceConfig(request.source)
  const table = await readTable(request.data, request.filename)
  const resolved = resolveMapping(table.columns, config)

  return {
    source: request.source,
    columns: table.columns,
    mapping: resolved.mapping,
    unmapped_columns: resolved.unmappedColumns,
    missing_required: resolved.missingRequired,
    pii_detected: findPii(table.columns, config),
    canonical_columns: [...CANONICAL_COLUMNS],
    required: [...config.required],
  }
}
