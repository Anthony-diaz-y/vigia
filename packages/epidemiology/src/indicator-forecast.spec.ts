import { describe, expect, it } from 'vitest'

import { forecastIndicator } from './indicator-forecast'

// Serie estacional semanal con un poco de ruido determinista
function seasonal(weeks: number, base = 100): number[] {
  return Array.from(
    { length: weeks },
    (_, index) =>
      base + 60 * Math.sin((2 * Math.PI * (index % 52)) / 52) + ((index * 7) % 5) + index * 0.2,
  )
}

describe('forecastIndicator', () => {
  it('publica un pronóstico semanal cuando le gana a repetir el año anterior', () => {
    const result = forecastIndicator(seasonal(3 * 52), 'week')
    expect(result.status).toBe('publish')
    expect(result.mase).not.toBeNull()
    expect(result.mase!).toBeLessThan(1)
    expect(result.points.map((point) => point.step)).toEqual([1, 2, 3, 4])
    for (const point of result.points) {
      expect(point.p10).toBeLessThanOrEqual(point.p50)
      expect(point.p50).toBeLessThanOrEqual(point.p90)
    }
  })

  it('explica que falta historia con menos de 2 años', () => {
    const result = forecastIndicator(seasonal(60), 'week')
    expect(result.status).toBe('insufficient_evidence')
    expect(result.points).toEqual([])
    expect(result.reason).toBe('Se necesitan al menos 2 años de datos semanales.')
  })

  it('pronostica meses con temporada de 12 y 3 meses de horizonte', () => {
    const months = Array.from(
      { length: 48 },
      (_, index) => 11 + Math.sin((2 * Math.PI * index) / 12) + (index % 3) * 0.05,
    )
    const result = forecastIndicator(months, 'month')
    expect(result.points.map((point) => point.step)).toEqual(
      result.status === 'publish' ? [1, 2, 3] : [],
    )
    expect(result.windows).toBeGreaterThanOrEqual(3)
  })

  it('no baja de cero cuando la serie nunca fue negativa', () => {
    const sparse = Array.from({ length: 3 * 52 }, (_, index) => (index % 52 < 4 ? 30 : 0))
    const result = forecastIndicator(sparse, 'week')
    expect(result.points.every((point) => point.p10 >= 0)).toBe(true)
  })
})

describe('forecast anchoring', () => {
  it('informa cuántos puntos usó para que el pronóstico se rotule desde el último periodo consolidado', () => {
    expect(forecastIndicator(seasonal(3 * 52), 'week').used).toBe(3 * 52 - 6)
    expect(forecastIndicator(seasonal(60), 'week').used).toBe(54)
  })
})
