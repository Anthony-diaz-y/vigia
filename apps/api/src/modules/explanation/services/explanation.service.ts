import { Inject, Injectable } from '@nestjs/common'
import type { ExplainResponse, GeoLevel, NarrativeDto } from '@vigia/contracts'
import {
  isDengueTopic,
  narrativeUnits,
  recommend,
  renderTemplate,
  topDrivers,
  type NarrativeUnit,
} from '@vigia/epidemiology'

import { DeepSeekClient } from '../../../common/llm/deepseek.client'
import { AnalysisRepository } from '../../analysis/repositories/analysis.repository'

const SYSTEM_PROMPT = [
  'Explica en español claro, para personas que no son estadísticas, qué mueve el pronóstico del indicador de un lugar. El tema puede ser cualquiera de salud: no asumas que es dengue.',
  '- Máximo 3 oraciones cortas (60 palabras), sin listas ni títulos.',
  '- No uses términos técnicos (SHAP, mean_shap, seno, coseno, nivel, valores numéricos).',
  '- Di qué factores empujan los casos hacia arriba y cuáles hacia abajo, y la acción más importante.',
  '- Usa solo los factores y acciones del JSON. Nunca hagas recomendaciones clínicas ni inventes acciones.',
].join('\n')

@Injectable()
export class ExplanationService {
  constructor(
    @Inject(AnalysisRepository) private readonly analysis: AnalysisRepository,
    @Inject(DeepSeekClient) private readonly llm: DeepSeekClient,
  ) {}

  // Calcula los factores principales y genera una narrativa por cada uno
  async explain(level: GeoLevel, uploadId?: number, indicator?: string): Promise<ExplainResponse> {
    await this.analysis.assertScope(uploadId)
    const context = await this.analysis.seriesContext(uploadId, indicator)
    const rows = await this.analysis.weeklyCases(level, uploadId, indicator)
    const wording = isDengueTopic(context.topic) && !context.generic ? 'dengue' : 'general'
    const drivers = recommend(topDrivers(rows, level), wording)
    const narratives = await Promise.all(
      narrativeUnits(drivers).map((unit) => this.narrative(unit)),
    )
    return { drivers, narratives }
  }

  // Redacta la narrativa de una geografía con la IA o usa la plantilla si la IA no responde
  private async narrative({ geo, payload }: NarrativeUnit): Promise<NarrativeDto> {
    const text = await this.llm.complete({ system: SYSTEM_PROMPT, user: JSON.stringify(payload) })
    return text === null
      ? { ...geo, source: 'template', text: renderTemplate(payload) }
      : { ...geo, source: 'deepseek', text }
  }
}
