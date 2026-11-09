import { Inject, Injectable, Logger } from '@nestjs/common'
import type { ExplainResponse, NarrativeDto } from '@vigia/contracts'
import {
  narrativePayloads,
  recommend,
  renderTemplate,
  topDrivers,
  type NarrativePayload,
} from '@vigia/epidemiology'
import type { GeoLevel } from '@vigia/contracts'

import { APP_CONFIG, type AppConfig } from '../../../shared/config/app-config'
import { AnalysisRepository } from '../../analysis/infrastructure/analysis.repository'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

const SYSTEM_PROMPT =
  'Resumí en español, en lenguaje claro, un pronóstico de salud pública. ' +
  'Nunca hagas recomendaciones clínicas ni decidas acciones; solo resumí ' +
  'los impulsores y las acciones provistas.'

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: unknown } }>
}

@Injectable()
export class ExplanationService {
  private readonly logger = new Logger(ExplanationService.name)

  constructor(
    @Inject(AnalysisRepository) private readonly analysis: AnalysisRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async explain(level: GeoLevel, uploadId?: number): Promise<ExplainResponse> {
    await this.analysis.assertScope(uploadId)
    const rows = await this.analysis.weeklyCases(level, uploadId)
    const drivers = recommend(topDrivers(rows, level))
    const narratives = await Promise.all(
      narrativePayloads(drivers).map((payload) => this.narrative(payload)),
    )
    return { drivers, narratives }
  }

  private async narrative(payload: NarrativePayload): Promise<NarrativeDto> {
    const template: NarrativeDto = {
      source: 'template',
      text: renderTemplate(payload),
    }
    const key = this.config.deepseekApiKey
    if (!key) {
      return template
    }

    try {
      const response = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(payload) },
          ],
          temperature: 0,
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) {
        throw new Error(`DeepSeek responded with ${response.status}`)
      }
      const data = (await response.json()) as DeepSeekResponse
      const text = data.choices?.[0]?.message?.content
      if (typeof text !== 'string' || text.length === 0) {
        throw new Error('DeepSeek returned an empty narrative')
      }
      return { source: 'deepseek', text }
    } catch (error: unknown) {
      this.logger.warn(
        `narrative fallback: ${error instanceof Error ? error.message : String(error)}`,
      )
      return template
    }
  }
}
