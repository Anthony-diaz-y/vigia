import type { OutlookDto } from '@vigia/contracts'

import { compactNumber, formatNumber } from '../../utils'

// Valor de la barra: número completo en pantallas anchas y abreviado en angostas
function BarValue({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="year-value">
        <span className="value-full">sin datos</span>
        <span className="value-short">—</span>
      </span>
    )
  }
  return (
    <span className="year-value">
      <span className="value-full">{formatNumber(value)}</span>
      <span className="value-short">{compactNumber(value)}</span>
    </span>
  )
}

// Barras anuales de casos observados, estimados y proyectados con su rango
export function YearBars({ outlook, unit }: { outlook: OutlookDto; unit: string }) {
  const { projection } = outlook.total
  const observed = outlook.total.history
  const history: Array<{ year: number; cases: number | null; estimated: boolean }> = []
  for (const point of observed) {
    const previous = history.at(-1)
    for (let year = (previous?.year ?? point.year) + 1; year < point.year; year += 1) {
      history.push({ year, cases: null, estimated: false })
    }
    history.push(point)
  }
  const peak = Math.max(
    1,
    ...observed.map((point) => point.cases),
    ...projection.map((point) => point.p90),
  )
  // Convierte un valor en porcentaje de altura respecto al pico
  const pct = (value: number) => `${(value / peak) * 100}%`
  const label = [
    ...history.map((point) =>
      point.cases === null
        ? `${point.year}: sin datos`
        : `${point.year}: ${formatNumber(point.cases)} ${unit}${point.estimated ? ' (estimado)' : ''}`,
    ),
    ...projection.map(
      (point) =>
        `${point.year}: ${formatNumber(point.p50)} ${unit} proyectados (entre ${formatNumber(
          point.p10,
          0,
        )} y ${formatNumber(point.p90)})`,
    ),
  ].join('. ')

  return (
    <div className="years" role="img" aria-label={label}>
      {history.map((point) => (
        <div key={point.year} className="year">
          <BarValue value={point.cases} />
          <div className="year-plot">
            {point.cases !== null && (
              <div
                className={`year-bar ${point.estimated ? 'bar-estimated' : 'bar-observed'}`}
                style={{ height: pct(point.cases) }}
              />
            )}
          </div>
          <span className="year-label">{point.year}</span>
        </div>
      ))}
      <div className="years-divider" aria-hidden="true" />
      {projection.map((point) => (
        <div
          key={point.year}
          className="year"
          title={`Entre ${formatNumber(point.p10)} y ${formatNumber(point.p90)}`}
        >
          <BarValue value={point.p50} />
          <div className="year-plot">
            <div className="year-bar bar-projected" style={{ height: pct(point.p50) }} />
            <div
              className="year-range"
              style={{ bottom: pct(point.p10), height: pct(point.p90 - point.p10) }}
            />
          </div>
          <span className="year-label">{point.year}</span>
        </div>
      ))}
    </div>
  )
}
