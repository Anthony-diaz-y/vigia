import { Inject, Injectable } from '@nestjs/common'
import type { ExplainResponse, GeoLevel, NarrativeDto } from '@vigia/contracts'
import {
  narrativePayloads,
  recommend,
  renderTemplate,
  topDrivers,
  type NarrativePayload,
} from '@vigia/epidemiology'

import { DeepSeekClient } from '../../../shared/llm/deepseek.client'
import { AnalysisRepository } from '../../analysis/infrastructure/analysis.repository'

const SYSTEM_PROMPT = [
  'Explicá en español claro, para personas que no son estadísticas, qué mueve el pronóstico de dengue de un departamento.',
  '- Máximo 3 oraciones cortas (60 palabras), sin listas ni títulos.',
  '- No uses términos técnicos (SHAP, mean_shap, seno, coseno, nivel, valores numéricos).',
  '- Decí qué factores empujan los casos hacia arriba y cuáles hacia abajo, y la acción más importante.',
  '- Usá solo los factores y acciones del JSON. Nunca hagas recomendaciones clínicas ni inventes acciones.',
].join('\n')

@Injectable()
export class ExplanationService {
  constructor(
    @Inject(AnalysisRepository) private readonly analysis: AnalysisRepository,
    @Inject(DeepSeekClient) private readonly llm: DeepSeekClient,
  ) {}

  // Calcula los factores principales y genera una narrativa por cada uno
  async explain(level: GeoLevel, uploadId?: number): Promise<ExplainResponse> {
    await this.analysis.assertScope(uploadId)
    const rows = await this.analysis.weeklyCases(level, uploadId)
    const drivers = recommend(topDrivers(rows, level))
    const narratives = await Promise.all(
      narrativePayloads(drivers).map((payload) => this.narrative(payload)),
    )
    return { drivers, narratives }
  }

  // Redacta la narrativa con la IA o usa la plantilla si la IA no responde
  private async narrative(payload: NarrativePayload): Promise<NarrativeDto> {
    const text = await this.llm.complete({ system: SYSTEM_PROMPT, user: JSON.stringify(payload) })
    return text === null
      ? { source: 'template', text: renderTemplate(payload) }
      : { source: 'deepseek', text }
  }
}
