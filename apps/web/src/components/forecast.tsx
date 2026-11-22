'use client'

import type { ForecastResponse } from '@vigia/contracts'

import { formatNumber, maseQuality } from '@/lib/format'

import { ForecastChart, type ForecastPoint } from './charts'
import { Badge, FORECAST_STATUS_LABELS, Kpi, Section } from './ui'

// Vista de pronóstico: indicadores, calidad del modelo y gráficos por departamento confiable
export function ForecastView({ forecast }: { forecast: ForecastResponse }) {
  const published = forecast.scorecard.filter((row) => row.status === 'publish')
  const evaluated = forecast.scorecard.filter((row) => row.windows > 0)
  const notEvaluated = forecast.scorecard.length - evaluated.length
  const meanMase = (() => {
    const values = published
      .map((row) => Number(row.mase))
      .filter((value) => Number.isFinite(value))
    if (values.length === 0) {
      return null
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length
  })()
  const maxHorizon =
    forecast.forecasts.length === 0 ? 0 : Math.max(...forecast.forecasts.map((row) => row.horizon))

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label="Pronósticos confiables"
          value={`${published.length} de ${forecast.scorecard.length}`}
          delta="le ganan a repetir el año anterior"
        />
        <Kpi
          label="Departamentos evaluados"
          value={evaluated.length}
          delta="con historia suficiente para probar"
        />
        <Kpi
          label="Error relativo (MASE)"
          value={meanMase === null ? '—' : formatNumber(meanMase, 2)}
          delta={
            meanMase === null
              ? 'sin pronósticos confiables'
              : meanMase < 1
                ? 'menor a 1: mejor que la referencia'
                : 'no mejora la referencia'
          }
          warn={meanMase !== null && meanMase >= 1}
        />
        <Kpi
          label="Mira hacia adelante"
          value={maxHorizon > 0 ? `${maxHorizon} semanas` : '—'}
          delta={maxHorizon > 0 ? 'con rango probable' : 'sin pronósticos publicados'}
        />
      </div>

      <Section title="Calidad del modelo por departamento">
        <div className="card-sub">
          Probamos el modelo contra semanas pasadas. Solo se publica donde comete menos error que
          repetir lo ocurrido el año anterior (MASE menor a 1).
        </div>
        {evaluated.length === 0 ? (
          <p className="text-sm text-muted">
            Ningún departamento alcanzó el mínimo de ventanas de backtest.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Departamento</th>
                  <th className="num">Pruebas</th>
                  <th className="num">MASE</th>
                  <th>Desempeño</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {evaluated.map((row) => {
                  const quality = maseQuality(row.mase)
                  return (
                    <tr key={row.department}>
                      <td>{row.department}</td>
                      <td className="num">{row.windows}</td>
                      <td className="num strong">{formatNumber(row.mase, 3)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="meter">
                            <div
                              className={`meter-fill ${
                                quality.className === 'badge-danger'
                                  ? 'tone-danger'
                                  : quality.className === 'badge-warn'
                                    ? 'tone-warn'
                                    : ''
                              }`}
                              style={{ width: `${quality.width}%` }}
                            />
                          </div>
                          <Badge
                            tone={
                              quality.className === 'badge-danger'
                                ? 'danger'
                                : quality.className === 'badge-warn'
                                  ? 'warn'
                                  : 'ok'
                            }
                          >
                            {quality.label}
                          </Badge>
                        </div>
                      </td>
                      <td>
                        <Badge tone={row.status === 'publish' ? 'ok' : 'warn'}>
                          {FORECAST_STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {notEvaluated > 0 && (
          <div className="card-note">
            {notEvaluated} departamento{notEvaluated > 1 ? 's' : ''} más no tiene
            {notEvaluated > 1 ? 'n' : ''} historia suficiente para probar el modelo.
          </div>
        )}
      </Section>

      {published.length > 0 && (
        <Section title="Casos esperados en las próximas semanas">
          <div className="card-sub">
            La línea es el valor más probable; la banda, el rango donde caería 8 de cada 10 veces.
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {published.map((department) => {
              const rows = forecast.forecasts
                .filter((row) => row.department === department.department)
                .sort((left, right) => left.horizon - right.horizon)
              const chartData: ForecastPoint[] = rows.map((row) => ({
                horizon: row.horizon,
                p10: row.p10,
                p50: row.p50,
                p90: row.p90,
                low: row.p10,
                band: row.p90 - row.p10,
                target: row.target_epi_week,
              }))
              return (
                <article
                  key={department.department}
                  className="rounded-[var(--radius-sm)] border border-border bg-surface-2 p-4"
                >
                  <header className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-text">{department.department}</h3>
                    <Badge tone="ok">MASE {formatNumber(department.mase, 2)}</Badge>
                  </header>
                  <ForecastChart data={chartData} />
                  <table className="data-table mt-2">
                    <thead>
                      <tr>
                        <th>Semana</th>
                        <th className="num">Mínimo</th>
                        <th className="num">Probable</th>
                        <th className="num">Máximo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.horizon}>
                          <td>
                            S{row.target_epi_week} de {row.target_year}
                          </td>
                          <td className="num">{formatNumber(row.p10, 0)}</td>
                          <td className="num strong">{formatNumber(row.p50, 0)}</td>
                          <td className="num">{formatNumber(row.p90, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              )
            })}
          </div>
        </Section>
      )}
    </>
  )
}
