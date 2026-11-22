import { Inject, Injectable } from '@nestjs/common'
import type { RecommendationsResponse, RecommendationSummaryDto } from '@vigia/contracts'
import {
  buildOutlook,
  buildRecommendations,
  recommend,
  recommendationPayload,
  renderRecommendationSummary,
  topDrivers,
  type Outlook,
  type RecommendationReport,
} from '@vigia/epidemiology'

import { DeepSeekClient } from '../../../shared/llm/deepseek.client'
import { buildAnomalies } from '../../analysis/domain/analysis'
import { AnalysisRepository } from '../../analysis/infrastructure/analysis.repository'
import { ForecastingService } from '../../forecasting/application/forecasting.service'

const SYSTEM_PROMPT = [
  'Sos un asistente que redacta un resumen para un equipo de vigilancia epidemiológica de dengue en Perú.',
  'Recibís un JSON con el nivel de alerta de cada departamento, los motivos y las acciones ya decididas.',
  'Reglas estrictas:',
  '- Escribí en español claro, para personas que no son estadísticas.',
  '- No inventes cifras, departamentos ni acciones: usá solo lo que está en el JSON.',
  '- No cambies los niveles de alerta ni agregues recomendaciones clínicas. Nombrá los niveles tal como vienen ("Alerta alta", "Atención", "Estable").',
  '- Ignorá los departamentos estables con muy pocos casos.',
  '- Sé muy breve. Respondé solo con un objeto JSON: {"headline": string, "text": string}.',
  '- "headline": máximo 8 palabras, dice dónde actuar o que todo está estable.',
  '- "text": una o dos oraciones cortas (máximo 35 palabras): el primer paso y, si viene, la tendencia a 5 años.',
].join('\n')

@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(AnalysisRepository) private readonly analysis: AnalysisRepository,
    @Inject(ForecastingService) private readonly forecasting: ForecastingService,
    @Inject(DeepSeekClient) private readonly llm: DeepSeekClient,
  ) {}

  // Devuelve el semáforo por departamento con motivos, acciones y un resumen redactado
  async recommendations(uploadId?: number): Promise<RecommendationsResponse> {
    const forecast = await this.forecasting.forecast('department', uploadId)
    const series = await this.analysis.weeklyCases('department', uploadId)

    const outlook = buildOutlook(series)
    const report = buildRecommendations({
      series,
      anomalies: buildAnomalies(series, 'department'),
      scorecard: forecast.scorecard,
      forecasts: forecast.forecasts,
      drivers: recommend(topDrivers(series, 'department')),
    })

    return {
      overall_level: report.overall_level,
      counts: report.counts,
      window: report.window,
      summary: await this.summary(report, outlook),
      items: report.items,
      outlook,
    }
  }

  // Pide el resumen a la IA y usa la plantilla si la respuesta no sirve
  private async summary(
    report: RecommendationReport,
    outlook: Outlook,
  ): Promise<RecommendationSummaryDto> {
    const trend = outlook.total.annual_change_pct
    const template = renderRecommendationSummary(report, trend)
    const answer = await this.llm.complete({
      system: SYSTEM_PROMPT,
      user: JSON.stringify(recommendationPayload(report, trend)),
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
