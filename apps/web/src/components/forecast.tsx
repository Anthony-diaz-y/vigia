'use client'

import type { ForecastResponse } from '@vigia/contracts'

import { formatNumber, maseQuality } from '@/lib/format'

import { ForecastChart, type ForecastPoint } from './charts'
import { Badge, FORECAST_STATUS_LABELS, Kpi, Section } from './ui'

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Publicados"
          value={`${published.length} / ${forecast.scorecard.length}`}
          delta="superan el baseline estacional"
        />
        <Kpi label="Evaluados" value={evaluated.length} delta="con ventanas de backtest" />
        <Kpi
          label="MASE promedio"
          value={meanMase === null ? '—' : formatNumber(meanMase, 2)}
          delta={
            meanMase === null
              ? 'sin datos'
              : meanMase < 1
                ? 'mejor que el baseline'
                : 'no supera el baseline'
          }
          warn={meanMase === null || meanMase >= 1}
        />
        <Kpi
          label="Horizonte"
          value={
            <span>
              {maxHorizon} <span className="text-[15px] font-medium">sem.</span>
            </span>
          }
          delta="cuantiles p10 · p50 · p90"
        />
      </div>

      <Section title="Scorecard de pronóstico">
        <div className="card-sub">
          Evaluación por departamento con backtest de origen rodante. Un MASE menor a 1 indica mejor
          desempeño que el baseline estacional (SeasonalNaive de 52 semanas).
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
                  <th className="num">Ventanas</th>
                  <th className="num">MASE</th>
                  <th className="num">WIS</th>
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
                      <td className="num">{formatNumber(row.wis, 3)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-[7px] min-w-[64px] flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className={`h-full rounded-full ${
                                quality.className === 'badge-danger'
                                  ? 'bg-danger'
                                  : quality.className === 'badge-warn'
                                    ? 'bg-warning'
                                    : 'bg-accent'
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
            {notEvaluated} departamento{notEvaluated > 1 ? 's' : ''} sin evidencia suficiente: no
            alcanzan el mínimo de ventanas de backtest, por lo que no se publica pronóstico.
          </div>
        )}
      </Section>

      {published.length > 0 && (
        <Section title="Pronóstico publicado por departamento">
          <div className="card-sub">
            La banda sombreada cubre el intervalo p10–p90; la línea central es la mediana (p50). A
            menor amplitud, mayor certeza.
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
                  className="rounded-[var(--radius-sm)] border border-border bg-surface p-4"
                >
                  <header className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-title">{department.department}</h3>
                    <Badge tone="ok">MASE {formatNumber(department.mase, 2)}</Badge>
                  </header>
                  <ForecastChart data={chartData} />
                  <table className="data-table mt-2">
                    <thead>
                      <tr>
                        <th>Horizonte</th>
                        <th className="num">Semana</th>
                        <th className="num">p10</th>
                        <th className="num">p50</th>
                        <th className="num">p90</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.horizon}>
                          <td>S+{row.horizon}</td>
                          <td className="num">{row.target_epi_week}</td>
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
          <div className="card-note">
            <strong className="font-semibold text-title">Por qué se publica o no.</strong> Solo se
            publica el pronóstico de los departamentos cuyo MASE en backtest supera al baseline
            estacional. El resto se marca como <em>evidencia insuficiente</em> para no presentar
            cifras sin respaldo. El WIS resume el error de la distribución (menor es mejor). Un
            pronóstico es apoyo a la decisión, no una predicción exacta.
          </div>
        </Section>
      )}
    </>
  )
}
