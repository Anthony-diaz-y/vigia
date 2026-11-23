import { Inject, Injectable } from '@nestjs/common'
import type { RecommendationsResponse, RecommendationSummaryDto } from '@vigia/contracts'
import {
  buildOutlook,
  DEFAULT_RECOMMENDATION_OPTIONS,
  buildRecommendations,
  isDengueTopic,
  recommend,
  recommendationPayload,
  renderRecommendationSummary,
  topDrivers,
  type Outlook,
  type RecommendationReport,
} from '@vigia/epidemiology'

import { DeepSeekClient } from '../../../common/llm/deepseek.client'
import { buildAnomalies } from '../../analysis/lib/analysis'
import { AnalysisRepository } from '../../analysis/repositories/analysis.repository'
import { ForecastingService } from '../../forecasting/services/forecasting.service'
import { ActionAdvisor, mergeActions } from './action-advisor'

const SYSTEM_PROMPT = [
  'Sos un asistente que redacta un resumen para un equipo de salud pública de Perú.',
  'Recibes un JSON con el tema del dataset, el indicador, el nivel de alerta de cada lugar, los motivos y las acciones ya decididas.',
  'Reglas estrictas:',
  '- Escribe en español claro, para personas que no son estadísticas.',
  '- No inventes cifras, departamentos ni acciones: usa solo lo que está en el JSON.',
  '- No cambies los niveles de alerta ni agregues recomendaciones clínicas. Nombrá los niveles tal como vienen ("Alerta alta", "Atención", "Estable").',
  '- Ignorá los lugares estables con muy pocos datos. Hablá del tema del dataset, no asumas que es dengue.',
  '- Sé muy breve. Responde solo con un objeto JSON: {"headline": string, "text": string}.',
  '- "headline": máximo 8 palabras, dice dónde actuar o que todo está estable.',
  '- "text": una o dos oraciones cortas (máximo 35 palabras): el primer paso y, si viene, la tendencia a 5 años.',
].join('\n')

@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(AnalysisRepository) private readonly analysis: AnalysisRepository,
    @Inject(ForecastingService) private readonly forecasting: ForecastingService,
    @Inject(DeepSeekClient) private readonly llm: DeepSeekClient,
    @Inject(ActionAdvisor) private readonly advisor: ActionAdvisor,
  ) {}

  // Devuelve el semáforo por lugar con motivos, acciones (de reglas o sugeridas por IA) y un resumen
  async recommendations(uploadId?: number, indicator?: string): Promise<RecommendationsResponse> {
    const context = await this.analysis.seriesContext(uploadId, indicator)
    const series = await this.analysis.weeklyCases('department', uploadId, indicator)
    const forecast = await this.forecasting.forecast('department', uploadId, indicator, series)
    const mean = context.indicator.kind === 'mean'
    const wording = isDengueTopic(context.topic) && !context.generic ? 'dengue' : 'general'

    const outlook = buildOutlook(mean ? [] : series)
    const report = buildRecommendations(
      {
        series,
        anomalies: buildAnomalies(series, 'department'),
        scorecard: forecast.scorecard,
        forecasts: forecast.forecasts,
        drivers: recommend(topDrivers(series, 'department'), wording),
      },
      wording === 'dengue'
        ? DEFAULT_RECOMMENDATION_OPTIONS
        : {
            indicatorLabel: context.label,
            aggregate: mean ? 'mean' : 'sum',
            direction: mean ? 'both' : 'up',
            actions: 'general',
          },
    )

    const suggestions =
      wording === 'general'
        ? await this.advisor.suggest({
            topic: context.topic,
            indicator: context.label,
            items: report.items.map((item) => ({
              place: item.department,
              level: item.level,
              reasons: item.reasons,
            })),
          })
        : null
    const items = mergeActions(report.items, suggestions)

    return {
      overall_level: report.overall_level,
      indicator_label: context.label,
      counts: report.counts,
      window: report.window,
      summary: await this.summary({ ...report, items }, outlook, context.topic, context.label),
      items,
      outlook,
    }
  }

  // Pide el resumen a la IA y usa la plantilla si la respuesta no sirve
  private async summary(
    report: RecommendationReport,
    outlook: Outlook,
    topic: string,
    indicator: string,
  ): Promise<RecommendationSummaryDto> {
    const trend = outlook.total.annual_change_pct
    const template = renderRecommendationSummary(report, trend)
    const answer = await this.llm.complete({
      system: SYSTEM_PROMPT,
      user: JSON.stringify({
        tema: topic || 'sin tema',
        indicador: indicator,
        ...recommendationPayload(report, trend),
      }),
      json: true,
    })
    const parsed = parseSummary(answer)
    return parsed
      ? { source: 'deepseek', ...parsed }
      : { source: 'template', headline: template.headline, text: template.text }
  }
}

// Extrae titular y texto del JSON de la IA o devuelve null si es inválido
function parseSummary(answer: string | null): { headline: string; text: string } | null {
  if (answer === null) {
    return null
  }
  try {
    const value = JSON.parse(answer) as { headline?: unknown; text?: unknown }
    if (
      typeof value.headline === 'string' &&
      typeof value.text === 'string' &&
      value.headline.trim() &&
      value.text.trim()
    ) {
      return { headline: value.headline.trim(), text: value.text.trim() }
    }
  } catch {}
  return null
}
