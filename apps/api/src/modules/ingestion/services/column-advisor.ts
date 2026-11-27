import { Inject, Injectable } from '@nestjs/common'
import {
  COLUMN_ROLES,
  MAPPING_TARGET_INFO,
  PLACE_LEVEL_INFO,
  PLACE_LEVELS,
  ROLE_INFO,
  isDescriptiveField,
  sanitizeValueLabels,
  type ColumnRole,
  type PlaceLevel,
} from '@vigia/epidemiology'

import { DeepSeekClient } from '../../../common/llm/deepseek.client'
import type { ColumnSuggestion, DatasetSuggestion, SuggestInput } from '../lib/columns'

const MAX_LABEL_LENGTH = 60
const MAX_REASON_LENGTH = 140
const MAX_TITLE_LENGTH = 80
const MAX_TOPIC_LENGTH = 40
const REPEATED_REASON = 'Ya hay otra columna con este uso, así que no se usará.'
const SINGLE_ROLES: ReadonlySet<ColumnRole> = new Set(['date', 'year', 'week', 'month'])

const SYSTEM_PROMPT = [
  'Sos un asistente que ayuda a cargar datasets de salud de Perú (cualquier tema) en Vigia.',
  'Recibes el nombre del archivo, sus columnas (nombre, tipo detectado y algunos ejemplos) y los roles posibles.',
  'responde solo un JSON: {"title":"","topic":"","columns":[{"column":"","label":"","role":"","level":null,"field":null,"reason":"","values":{}}]}.',
  '- title: nombre corto del dataset en español (máximo 6 palabras). topic: tema en minúsculas (por ejemplo "dengue", "anemia", "egresos hospitalarios").',
  '- Una entrada por cada columna recibida, con el nombre exacto.',
  '- label: qué contiene la columna, en español claro, máximo 5 palabras, y distinto para cada columna (nunca repitas un label).',
  '- Si los encabezados son códigos de una encuesta conocida (por ejemplo ENDES/DHS: HV001, HV025…) usa su significado oficial; si no, dedúcelo de los ejemplos y del resto de columnas.',
  '- "year", "week" y "month" solo si los valores son años, semanas (1-53) o meses (1-12); códigos de fecha como el mes continuo de ENDES (HV008) van en "ignore".',
  '- Usa "ignore" solo para constantes, fechas de corte, texto libre o códigos de registro; toda columna con información útil debe tener un rol y casi todas se usan.',
  '- "count" es un número entero que se suma (casos, atenciones, consultas, personas, niños, exámenes); puede haber VARIAS columnas "count" en el mismo archivo.',
  '- "measure" es un valor que se promedia (promedios, porcentajes, tasas, edad, hemoglobina); un número que no se suma es "measure", nunca "ignore".',
  '- Columnas como "casos_2024" (casos por año) o "casos_leve", "cas_mod", "cas_sev" (casos por gravedad) son "count": no son "year" ni "ignore".',
  '- role: uno de los ids de roles. level: solo si role es "place", uno de los niveles de lugar.',
  '- field: opcional, solo para role "category" o "measure", el id de campo epidemiológico que corresponda (sexo, edad, diagnóstico…) o null.',
  '- Usa role "date" una sola vez: la fecha más cercana al inicio del caso (síntomas, notificación, ingreso, toma de muestra); nunca egreso, alta, corte o actualización.',
  '- Si una columna junta departamento, provincia y distrito, usa role "place" con level "location".',
  '- Los códigos de registro o de persona van con role "identifier". Constantes o columnas sin utilidad, "ignore".',
  '- Los códigos UBIGEO de departamento (2 dígitos), provincia (4) o distrito (6), por ejemplo cod_prov o cod_dist, van con role "place" y su nivel ("department", "province" o "district"); Vigia los traduce a nombres. Si otra columna ya trae los nombres de ese nivel, el código va en "ignore".',
  '- Los demás códigos numéricos (de red, microrred, institución…) nunca son "measure": usa "category" si se repiten o "identifier" si son casi únicos.',
  '- reason: por qué elegiste ese rol, máximo 12 palabras.',
  '- values: opcional, solo para columnas con "valores" (códigos cortos): {"código":"significado"} con etiquetas en español de máximo 4 palabras. Solo códigos de la lista "valores", solo si estás seguro de su significado; si no lo sabes con certeza, omite "values". Nunca inventes.',
].join('\n')

interface RawSuggestion {
  column?: unknown
  label?: unknown
  role?: unknown
  level?: unknown
  field?: unknown
  reason?: unknown
  values?: unknown
}

@Injectable()
export class ColumnAdvisor {
  constructor(@Inject(DeepSeekClient) private readonly llm: DeepSeekClient) {}

  // Pide a la IA el título, el tema y el rol de cada columna; null si no hay IA o responde mal
  async suggest(input: SuggestInput): Promise<DatasetSuggestion | null> {
    if (!this.llm.enabled || input.columns.length === 0) {
      return null
    }
    const user = JSON.stringify({
      archivo: input.filename,
      roles: ROLE_INFO,
      niveles_de_lugar: PLACE_LEVEL_INFO,
      campos: MAPPING_TARGET_INFO.map(({ id, label }) => ({ id, label })),
      columnas: input.columns.map((column) => ({
        nombre: column.name,
        tipo: column.kind,
        ejemplos: column.samples,
        ...(column.codes ? { valores: column.codes } : {}),
      })),
    })
    const text = await this.llm.complete({ system: SYSTEM_PROMPT, user, json: true })
    return text === null
      ? null
      : parseSuggestions(
          text,
          input.columns.map((column) => column.name),
          Object.fromEntries(
            input.columns.flatMap((column) => (column.codes ? [[column.name, column.codes]] : [])),
          ),
        )
  }
}

// Valida la respuesta: columnas reales, roles y niveles conocidos, una sola fecha y códigos con significado reales
export function parseSuggestions(
  text: string,
  columns: readonly string[],
  codes: Readonly<Record<string, readonly string[]>> = {},
): DatasetSuggestion | null {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    return null
  }
  const record = (payload ?? {}) as Record<string, unknown>
  if (!Array.isArray(record.columns)) {
    return null
  }

  const names = new Set(columns)
  const seen = new Set<string>()
  const taken = new Set<string>()
  const suggestions: ColumnSuggestion[] = []
  for (const raw of record.columns as RawSuggestion[]) {
    const column = typeof raw?.column === 'string' ? raw.column : null
    if (column === null || !names.has(column) || seen.has(column)) {
      continue
    }
    seen.add(column)
    let role: ColumnRole = (COLUMN_ROLES as readonly unknown[]).includes(raw.role)
      ? (raw.role as ColumnRole)
      : 'ignore'
    let repeated = false
    if (SINGLE_ROLES.has(role)) {
      repeated = taken.has(role)
      taken.add(role)
      role = repeated ? 'ignore' : role
    }
    const level: PlaceLevel | null =
      role !== 'place'
        ? null
        : (PLACE_LEVELS as readonly unknown[]).includes(raw.level)
          ? (raw.level as PlaceLevel)
          : 'department'
    const field =
      (role === 'category' || role === 'measure') && isDescriptiveField(raw.field)
        ? raw.field
        : null
    const values =
      role === 'category' ? sanitizeValueLabels(raw.values, codes[column] ?? []) : undefined
    suggestions.push({
      column,
      label: shortText(raw.label, MAX_LABEL_LENGTH),
      role,
      level,
      field,
      reason: repeated
        ? REPEATED_REASON
        : role === 'ignore'
          ? null
          : shortText(raw.reason, MAX_REASON_LENGTH),
      ...(values ? { values } : {}),
    })
  }
  if (suggestions.length === 0) {
    return null
  }
  return {
    title: shortText(record.title, MAX_TITLE_LENGTH),
    topic: shortText(record.topic, MAX_TOPIC_LENGTH)?.toLowerCase() ?? null,
    columns: suggestions,
  }
}

// Devuelve el texto recortado si es válido y no supera el largo máximo
function shortText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null
}
