'use client'

import type { ForecastResponse } from '@vigia/contracts'

import { ForecastChart } from '@/modules/shared/components/charts'
import { Badge, ErrorBanner, Kpi, LoadingState, Section } from '@/modules/shared/components/ui'
import { FORECAST_STATUS_LABELS } from '@/modules/shared/constants'
import { useDashboardFilters } from '@/modules/shared/contexts'
import { useForecast } from '@/modules/shared/hooks'
import { errorMessage, formatNumber, maseQuality, plural } from '@/modules/shared/utils'

import { averageMase, departmentForecast, toForecastPoints } from '../utils/forecast-points'

// Página de pronóstico: indicadores, calidad del modelo y gráficos por departamento confiable
export function PronosticoPage() {
  const { uploadId } = useDashboardFilters()
  const { data: forecast, isError, error } = useForecast(uploadId)

  if (isError) {
    return <ErrorBanner message={errorMessage(error)} />
  }

  if (!forecast) {
    return <LoadingState label="Calculando el pronóstico…" />
  }

  return <ForecastContent forecast={forecast} />
}

// Indicadores, calidad del modelo y gráficos de los departamentos con pronóstico confiable
function ForecastContent({ forecast }: { forecast: ForecastResponse }) {
  const published = forecast.scorecard.filter((row) => row.status === 'publish')
  const evaluated = forecast.scorecard.filter((row) => row.windows > 0)
  const notEvaluated = forecast.scorecard.length - evaluated.length
  const meanMase = averageMase(published)
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
                              className={`meter-fill tone-${quality.tone}`}
                              style={{ width: `${quality.width}%` }}
                            />
                          </div>
                          <Badge tone={quality.tone}>{quality.label}</Badge>
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
            {notEvaluated} {plural(notEvaluated, 'departamento')} más no{' '}
            {plural(notEvaluated, 'tiene', 'tienen')} historia suficiente para probar el modelo.
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
              const rows = departmentForecast(forecast.forecasts, department.department)
              return (
                <article
                  key={department.department}
                  className="rounded-[var(--radius-sm)] border border-border bg-surface-2 p-4"
                >
                  <header className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-text">{department.department}</h3>
                    <Badge tone="ok">MASE {formatNumber(department.mase, 2)}</Badge>
                  </header>
                  <ForecastChart data={toForecastPoints(rows)} />
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
                          <td className="num">{formatNumber(row.p10)}</td>
                          <td className="num strong">{formatNumber(row.p50)}</td>
                          <td className="num">{formatNumber(row.p90)}</td>
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
