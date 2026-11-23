import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

import { MAPPING_TARGETS, isMappingTarget, missingRequirements } from '@vigia/epidemiology'
import { WRatio } from 'fuzzball'
import { parse as parseYaml } from 'yaml'

import { SourceConfigError } from './errors'

export const FUZZY_THRESHOLD = 85

export interface SourceConfig {
  source: string
  disease: string
  columns: Record<string, string[]>
  piiAliases: string[]
}

export interface MappingResult {
  mapping: Record<string, string>
  unmappedColumns: string[]
  missingRequired: string[]
}

interface RawSourceConfig {
  source?: unknown
  disease?: unknown
  columns?: unknown
  pii_aliases?: unknown
}

// Normaliza un encabezado a una clave comparable sin mayúsculas, tildes ni signos
export function normalizeHeader(name: string): string {
  const decomposed = String(name).normalize('NFKD')
  const stripped = decomposed.replace(/\p{M}/gu, '')
  const lowered = stripped.trim().toLowerCase()
  let collapsed = ''
  for (const char of lowered) {
    collapsed += /[\p{L}\p{N}]/u.test(char) ? char : '_'
  }
  return collapsed
    .split('_')
    .filter((part) => part.length > 0)
    .join('_')
}

// Busca el directorio config/mappings desde la variable de entorno o el directorio actual
export function configDir(): string {
  const starts = [
    process.env.VIGIA_CONFIG_DIR,
    process.cwd(),
    typeof __dirname === 'undefined' ? '' : __dirname,
  ].filter((value): value is string => Boolean(value))

  for (const start of starts) {
    const direct = resolve(start)
    if (basename(direct) === 'mappings' && existsSync(direct)) {
      return direct
    }
    let current = direct
    for (;;) {
      const candidate = join(current, 'config', 'mappings')
      if (existsSync(candidate)) {
        return candidate
      }
      const parent = dirname(current)
      if (parent === current) {
        break
      }
      current = parent
    }
  }
  throw new SourceConfigError('apps/api/config/mappings directory not found')
}

// Carga y valida el YAML de mapeo de una fuente con sus alias normalizados
export function loadSourceConfig(source: string): SourceConfig {
  if (!/^[a-z0-9_-]+$/i.test(source)) {
    throw new SourceConfigError(`unknown source mapping: ${source}`)
  }
  const path = join(configDir(), `${source}.yaml`)
  if (!existsSync(path)) {
    throw new SourceConfigError(`unknown source mapping: ${source}`)
  }

  let payload: RawSourceConfig
  try {
    payload = (parseYaml(readFileSync(path, 'utf8')) ?? {}) as RawSourceConfig
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new SourceConfigError(`invalid source mapping ${source}: ${message}`)
  }

  if (typeof payload.source !== 'string' || typeof payload.disease !== 'string') {
    throw new SourceConfigError(`invalid source mapping ${source}: missing source or disease`)
  }

  const columns = isRecord(payload.columns) ? payload.columns : {}
  const normalizedColumns: Record<string, string[]> = {}
  for (const [canonical, aliases] of Object.entries(columns)) {
    if (Array.isArray(aliases)) {
      normalizedColumns[canonical] = aliases.map((alias) => normalizeHeader(String(alias)))
    }
  }

  return {
    source: payload.source,
    disease: payload.disease.toUpperCase(),
    columns: normalizedColumns,
    piiAliases: Array.isArray(payload.pii_aliases)
      ? payload.pii_aliases.map((alias) => normalizeHeader(String(alias)))
      : [],
  }
}

// Devuelve las columnas que coinciden con alias de datos personales
export function findPii(columns: readonly string[], config: SourceConfig): string[] {
  const blocked = new Set(config.piiAliases)
  return columns.filter((name) => blocked.has(normalizeHeader(name)))
}

// Asocia campos a encabezados por alias y luego por similitud (nunca fechas: se confunden entre sí)
export function resolveMapping(columns: readonly string[], config: SourceConfig): MappingResult {
  const byKey = new Map<string, string>()
  for (const name of columns) {
    byKey.set(normalizeHeader(name), name)
  }

  const mapping: Record<string, string> = {}
  const used = new Set<string>()

  for (const canonical of MAPPING_TARGETS) {
    const aliases = config.columns[canonical] ?? []
    if (aliases.length === 0) {
      continue
    }
    for (const alias of aliases) {
      const source = byKey.get(alias)
      if (source !== undefined && !used.has(source)) {
        mapping[canonical] = source
        used.add(source)
        break
      }
    }
  }

  for (const canonical of MAPPING_TARGETS) {
    if (mapping[canonical] !== undefined || canonical === 'event_date') {
      continue
    }
    const aliases = config.columns[canonical] ?? []
    if (aliases.length === 0) {
      continue
    }
    const candidates = [...byKey.entries()].filter(([, name]) => !used.has(name))
    if (candidates.length === 0) {
      continue
    }
    const query = aliases.reduce((longest, alias) =>
      alias.length > longest.length ? alias : longest,
    )
    let bestKey: string | undefined
    let bestScore = -1
    for (const [key] of candidates) {
      const score = WRatio(query, key)
      if (score > bestScore) {
        bestKey = key
        bestScore = score
      }
    }
    if (bestKey !== undefined && bestScore >= FUZZY_THRESHOLD) {
      const source = byKey.get(bestKey)
      if (source !== undefined) {
        mapping[canonical] = source
        used.add(source)
      }
    }
  }

  return mappingResult(columns, mapping)
}

// Aplica un mapeo explícito canónico a origen descartando entradas no válidas
export function resolveMappingOverride(
  columns: readonly string[],
  override: Record<string, string>,
): MappingResult {
  const available = new Set(columns)
  const mapping: Record<string, string> = {}
  for (const [target, source] of Object.entries(override)) {
    if (isMappingTarget(target) && available.has(source)) {
      mapping[target] = source
    }
  }
  return mappingResult(columns, mapping)
}

// Completa el resultado con las columnas sin usar y los requisitos que faltan cubrir
export function mappingResult(
  columns: readonly string[],
  mapping: Record<string, string>,
): MappingResult {
  const used = new Set(Object.values(mapping))
  return {
    mapping,
    unmappedColumns: columns.filter((name) => !used.has(name)),
    missingRequired: missingRequirements(Object.keys(mapping)).map((group) => group.id),
  }
}

// Indica si el valor es un objeto plano (no nulo ni arreglo)
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
