import { describe, expect, it, vi } from 'vitest'

import { RecommendationsService } from './recommendations.service'

// Serie de 20 semanas: Junín sube fuerte en las semanas consolidadas recientes
function series() {
  return Array.from({ length: 20 }, (_, index) => ({
    department: 'JUNIN',
    year: 2026,
    epi_week: index + 1,
    cases: index >= 10 && index < 14 ? 60 : 20,
  }))
}

// Arma el servicio con dependencias simuladas y el tema indicado
function service(topic: string, generic: boolean) {
  const analysis = {
    seriesContext: vi.fn(async () => ({
      topic,
      indicator: { kind: 'records' as const },
      label: generic ? 'Registros' : 'Casos',
      generic,
    })),
    weeklyCases: vi.fn(async () => series()),
  }
  const forecasting = {
    forecast: vi.fn(async () => ({ model_id: 'x', scorecard: [], forecasts: [] })),
  }
  const llm = { enabled: true, complete: vi.fn(async () => null) }
  const advisor = { suggest: vi.fn(async () => ({ JUNIN: ['Revisar el tamizaje en Junín.'] })) }
  const instance = new RecommendationsService(
    analysis as never,
    forecasting as never,
    llm as never,
    advisor as never,
  )
  return { instance, advisor }
}

describe('RecommendationsService', () => {
  it('marca como sugeridas por IA las acciones fuera del dengue', async () => {
    const { instance, advisor } = service('anemia', true)
    const body = await instance.recommendations(1)
    const junin = body.items.find((item) => item.department === 'JUNIN')
    expect(advisor.suggest).toHaveBeenCalledOnce()
    expect(junin?.actions).toEqual(['Revisar el tamizaje en Junín.'])
    expect(junin?.actions_source).toBe('deepseek')
    expect(body.indicator_label).toBe('Registros')
  })

  it('con dengue nunca pide acciones a la IA', async () => {
    const { instance, advisor } = service('dengue', false)
    const body = await instance.recommendations(1)
    expect(advisor.suggest).not.toHaveBeenCalled()
    expect(body.items.every((item) => item.actions_source === 'rules')).toBe(true)
  })
})
