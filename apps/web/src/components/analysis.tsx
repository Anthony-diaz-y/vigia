'use client'

import { useState } from 'react'

import type { AnomalyRow, HeatmapResponse, RankingRow } from '@vigia/contracts'

import { formatNumber, severityOf } from '@/lib/format'

import { Badge, Section } from './ui'

const RANKING_PREVIEW = 8

export function HeatmapCard({ heatmap, year }: { heatmap: HeatmapResponse | null; year: number }) {
  const heatMax = heatmap ? Math.max(1, ...heatmap.values.flat()) : 1
  const rows = heatmap
    ? heatmap.geographies
        .map((geo, index) => ({ geo, values: heatmap.values[index] ?? [] }))
        .filter((row) => row.values.some((value) => value > 0))
    : []
  const hidden = heatmap ? heatmap.geographies.length - rows.length : 0

  return (
    <Section title="Mapa de calor · departamento × semana">
      <div className="card-sub">
        Intensidad de casos notificados en {year}. Cada columna es una semana epidemiológica, cada
        fila un departamento.
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
          <div className="card-note">
            Escala relativa al máximo del período y en raíz cuadrada para que los valores bajos
            sigan siendo visibles. Las semanas sin notificación aparecen en blanco.
            {hidden > 0 &&
              ` Se omiten ${hidden} departamento${hidden > 1 ? 's' : ''} sin casos notificados.`}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Sin datos para el año seleccionado.</p>
      )}
    </Section>
  )
}

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
    <Section title={`Ranking por casos · ${year}`}>
      {ranking.length > 0 ? (
        <>
          <div
            className={`flex flex-col gap-3${showAll ? ' max-h-[420px] overflow-y-auto pr-1' : ''}`}
          >
            {visible.map((row) => {
              const name = row.province || row.department
              const share = total ? (row.cases / total) * 100 : 0
              const width = max ? (row.cases / max) * 100 : 0
              return (
                <div key={`${row.department}-${row.province ?? ''}`}>
                  <div className="rank-head">
                    <span className="rank-name">{name}</span>
                    <span className="rank-value">{row.cases.toLocaleString('es-PE')}</span>
                  </div>
                  <div className="rank-track">
                    <div className="rank-fill" style={{ width: `${width}%` }} />
                  </div>
                  <div className="rank-share">{share.toFixed(1)}% del total</div>
                </div>
              )
            })}
          </div>
          {ranking.length > RANKING_PREVIEW && (
            <button
              type="button"
              className="btn btn-ghost mt-3"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
            >
              {showAll ? 'Ver menos' : `Ver los ${ranking.length} departamentos`}
            </button>
          )}
          <div className="card-note">
            Ordenado por casos acumulados del año. Porcentaje sobre el total notificado.
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Sin datos de ranking para el año seleccionado.</p>
      )}
    </Section>
  )
}

export function AnomaliesCard({
  anomalies,
  flagged,
}: {
  anomalies: ReadonlyArray<AnomalyRow>
  flagged: ReadonlyArray<AnomalyRow>
}) {
  const sorted = [...flagged].sort((left, right) => Number(right.robust_z) - Number(left.robust_z))

  return (
    <Section title={`Anomalías detectadas · ${flagged.length} señaladas`}>
      <div className="card-sub">
        Semanas cuyo volumen se aparta del patrón estacional esperado, sobre todo el período
        disponible y ordenadas por severidad.
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
                  <th>Severidad</th>
                  <th>Departamento</th>
                  <th>Año</th>
                  <th>Semana</th>
                  <th className="num">Casos</th>
                  <th className="num">Base estacional</th>
                  <th className="num">Residual</th>
                  <th className="num">z robusto</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
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
                      <td>{row.year}</td>
                      <td>{row.epi_week}</td>
                      <td className="num">{row.cases}</td>
                      <td className="num">{formatNumber(row.seasonal_baseline, 1)}</td>
                      <td className="num">{formatNumber(row.residual, 1)}</td>
                      <td className="num strong">{formatNumber(row.robust_z, 2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="card-note">
            <strong className="font-semibold text-title">Cómo leerlo.</strong> El <em>z robusto</em>{' '}
            mide cuánto se aparta una semana de su base estacional, en desviaciones robustas (MAD).
            Valores sobre 2,5 se consideran señal; sobre 3, señal alta. El <em>residual</em> es la
            diferencia cruda entre los casos observados y la base. Una señal puede deberse a un
            brote real o a notificación tardía: verificar antes de escalar.
          </div>
        </>
      )}
    </Section>
  )
}
