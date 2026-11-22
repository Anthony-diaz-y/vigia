'use client'

import { useState } from 'react'

import type { AnomalyRow, HeatmapResponse, RankingRow } from '@vigia/contracts'

import { formatNumber, severityOf } from '@/lib/format'

import { Badge, Section } from './ui'

const RANKING_PREVIEW = 8
const ANOMALY_PREVIEW = 10

// Mapa de calor de casos por departamento y semana del año elegido
export function HeatmapCard({ heatmap, year }: { heatmap: HeatmapResponse | null; year: number }) {
  const heatMax = heatmap ? Math.max(1, ...heatmap.values.flat()) : 1
  const rows = heatmap
    ? heatmap.geographies
        .map((geo, index) => ({ geo, values: heatmap.values[index] ?? [] }))
        .filter((row) => row.values.some((value) => value > 0))
    : []
  const hidden = heatmap ? heatmap.geographies.length - rows.length : 0

  return (
    <Section title={`Casos por semana en ${year}`}>
      <div className="card-sub">
        Cada fila es un departamento y cada cuadro una semana. Más oscuro, más casos.
      </div>
      {heatmap ? (
        <>
          <div className="overflow-x-auto" aria-label="Mapa de calor de casos por semana">
            <div
              className="heatmap-grid min-w-max"
              style={{
                gridTemplateColumns: `132px repeat(${heatmap.weeks.length}, 16px)`,
              }}
            >
              <div className="hm-corner" />
              {heatmap.weeks.map((week) => (
                <div key={`w-${week}`} className="hm-xlabel" title={`Semana ${week}`}>
                  {week % 4 === 1 ? week : ''}
                </div>
              ))}
              {rows.map(({ geo, values }) => (
                <div key={geo} className="contents">
                  <div className="hm-ylabel" title={geo}>
                    {geo}
                  </div>
                  {values.map((value, cellIndex) => {
                    const alpha = 0.08 + 0.9 * Math.sqrt(value / heatMax)
                    return (
                      <span
                        key={`${geo}-${cellIndex}`}
                        className="hm-cell"
                        title={`${geo} · semana ${heatmap.weeks[cellIndex]}: ${value} casos`}
                        style={{
                          background: `rgba(var(--heat), ${alpha.toFixed(3)})`,
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="hm-legend">
            <span className="text-muted">0</span>
            <span className="hm-legend-bar" />
            <span className="text-muted">{heatMax} casos</span>
          </div>
          {hidden > 0 && (
            <div className="card-note">
              Se omiten {hidden} departamento{hidden > 1 ? 's' : ''} sin casos notificados.
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Sin datos para el año seleccionado.</p>
      )}
    </Section>
  )
}

// Ranking de departamentos con más casos con barras y opción de ver todos
export function RankingCard({
  ranking,
  year,
}: {
  ranking: ReadonlyArray<RankingRow>
  year: number
}) {
  const [showAll, setShowAll] = useState(false)
  const total = ranking.reduce((sum, row) => sum + (row.cases ?? 0), 0)
  const max = ranking.reduce((peak, row) => Math.max(peak, row.cases ?? 0), 0)
  const visible = showAll ? ranking : ranking.slice(0, RANKING_PREVIEW)

  return (
    <Section title={`Departamentos con más casos en ${year}`}>
      {ranking.length > 0 ? (
        <>
          <div
            className={`mt-3 flex flex-col gap-3.5${showAll ? ' max-h-[420px] overflow-y-auto pr-1' : ''}`}
          >
            {visible.map((row) => {
              const name = row.province || row.department
              const share = total ? (row.cases / total) * 100 : 0
              const width = max ? (row.cases / max) * 100 : 0
              return (
                <div key={`${row.department}-${row.province ?? ''}`} className="rank-row">
                  <span className="rank-name" title={name}>
                    {name}
                  </span>
                  <div className="rank-track">
                    <div className="rank-fill" style={{ width: `${Math.max(width, 1)}%` }} />
                  </div>
                  <span className="rank-value">
                    {row.cases.toLocaleString('es-PE')}
                    <span className="rank-share">{share.toFixed(1)} %</span>
                  </span>
                </div>
              )
            })}
          </div>
          {ranking.length > RANKING_PREVIEW && (
            <button
              type="button"
              className="link-btn mt-4"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
            >
              {showAll ? 'Ver menos' : `Ver los ${ranking.length} departamentos`}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Sin datos de ranking para el año seleccionado.</p>
      )}
    </Section>
  )
}

// Tabla de semanas anómalas ordenadas por desvío, con su severidad
export function AnomaliesCard({
  anomalies,
  flagged,
}: {
  anomalies: ReadonlyArray<AnomalyRow>
  flagged: ReadonlyArray<AnomalyRow>
}) {
  const [showAll, setShowAll] = useState(false)
  const sorted = [...flagged].sort(
    (left, right) => Math.abs(Number(right.robust_z)) - Math.abs(Number(left.robust_z)),
  )
  const visible = showAll ? sorted : sorted.slice(0, ANOMALY_PREVIEW)

  return (
    <Section title="Semanas fuera de lo esperado">
      <div className="card-sub">
        {flagged.length} semana{flagged.length === 1 ? '' : 's'} con casos muy por encima o por
        debajo de lo habitual para esa época del año, de la más a la menos marcada.
      </div>
      {anomalies.length === 0 ? (
        <p className="text-sm text-muted">Sin datos de anomalías para el período.</p>
      ) : flagged.length === 0 ? (
        <p className="text-sm text-muted">
          Sin anomalías: todas las semanas se mantienen dentro del rango esperado.
        </p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Señal</th>
                  <th>Departamento</th>
                  <th>Semana</th>
                  <th className="num">Casos</th>
                  <th className="num">Esperado</th>
                  <th className="num">Desvío</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const severity = severityOf(row.robust_z)
                  return (
                    <tr key={`${row.department}-${row.year}-${row.epi_week}`}>
                      <td>
                        <Badge
                          tone={
                            severity.className === 'badge-danger'
                              ? 'danger'
                              : severity.className === 'badge-warn'
                                ? 'warn'
                                : 'ok'
                          }
                        >
                          {severity.label}
                        </Badge>
                      </td>
                      <td>{row.department}</td>
                      <td>
                        S{row.epi_week} de {row.year}
                      </td>
                      <td className="num strong">{formatNumber(row.cases, 0)}</td>
                      <td className="num">{formatNumber(row.seasonal_baseline, 0)}</td>
                      <td className="num">{formatNumber(row.robust_z, 1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > ANOMALY_PREVIEW && (
            <button
              type="button"
              className="link-btn mt-3"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
            >
              {showAll ? 'Ver menos' : `Ver las ${sorted.length} semanas`}
            </button>
          )}
          <div className="card-note">
            El desvío indica cuántas veces se aleja la semana de lo habitual: desde 2,5 es señal,
            desde 3 es señal alta. Puede ser un brote real o un retraso de notificación; verificá
            antes de escalar.
          </div>
        </>
      )}
    </Section>
  )
}
