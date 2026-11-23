import { Inject, Injectable } from '@nestjs/common'
import type { AlertLevel } from '@vigia/epidemiology'

import { DeepSeekClient } from '../../../shared/llm/deepseek.client'

export interface ActionFacts {
  topic: string
  indicator: string
  items: { place: string; level: AlertLevel; reasons: string[] }[]
}

export type ActionSource = 'rules' | 'deepseek'

const MAX_ACTIONS = 2
const MAX_WORDS = 20
const CLINICAL =
  /\d\s*(mg|ml|g|ui|mcg)\b|dosis|medicamento|f[aá]rmaco|antibi[oó]tico|tratamiento con/i

const SYSTEM_PROMPT = [
  'Sos un asistente para equipos de salud pública de Perú.',
  'Recibes el tema de un dataset, el indicador y las zonas con alerta, con los hechos que la explican.',
  'Propón hasta 2 acciones concretas de gestión para cada zona, en español claro y de máximo 20 palabras cada una.',
  '- Solo acciones de gestión, vigilancia, registro o coordinación; nunca indicaciones clínicas, dosis ni medicamentos.',
  '- Usa solo las zonas recibidas y no inventes cifras.',
  'Responde solo un JSON: {"acciones":[{"lugar":"","acciones":["",""]}]}.',
].join('\n')

@Injectable()
export class ActionAdvisor {
  constructor(@Inject(DeepSeekClient) private readonly llm: DeepSeekClient) {}

  // Pide a la IA acciones para las zonas con alerta; null si no hay IA, zonas o respuesta válida
  async suggest(facts: ActionFacts): Promise<Record<string, string[]> | null> {
    const items = facts.items.filter((item) => item.level !== 'bajo')
    if (!this.llm.enabled || items.length === 0) {
      return null
    }
    const text = await this.llm.complete({
      system: SYSTEM_PROMPT,
      user: JSON.stringify({ tema: facts.topic, indicador: facts.indicator, zonas: items }),
      json: true,
    })
    return text === null
      ? null
      : parseActions(
          text,
          items.map((item) => item.place),
        )
  }
}

// Valida la respuesta: zonas conocidas, hasta 2 acciones cortas y sin indicaciones clínicas
export function parseActions(
  text: string,
  places: readonly string[],
): Record<string, string[]> | null {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    return null
  }
  const entries = (payload as { acciones?: unknown })?.acciones
  if (!Array.isArray(entries)) {
    return null
  }
  const known = new Set(places)
  const result: Record<string, string[]> = {}
  for (const entry of entries as Array<{ lugar?: unknown; acciones?: unknown }>) {
    const place = typeof entry?.lugar === 'string' ? entry.lugar : null
    if (place === null || !known.has(place) || !Array.isArray(entry.acciones)) {
      continue
    }
    const actions = entry.acciones
      .filter((action): action is string => typeof action === 'string')
      .map((action) => action.trim())
      .filter((action) => action.length > 0)
      .filter((action) => action.split(/\s+/).length <= MAX_WORDS && !CLINICAL.test(action))
      .slice(0, MAX_ACTIONS)
    if (actions.length > 0) {
      result[place] = actions
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

// Reemplaza las acciones de reglas por las de la IA donde haya sugerencia y marca su origen
export function mergeActions<T extends { department: string; actions: string[] }>(
  items: readonly T[],
  suggestions: Record<string, string[]> | null,
): (T & { actions_source: ActionSource })[] {
  return items.map((item) => {
    const suggested = suggestions?.[item.department]
    return suggested
      ? { ...item, actions: suggested, actions_source: 'deepseek' }
      : { ...item, actions_source: 'rules' }
  })
}
