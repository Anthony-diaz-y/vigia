'use client'

import { useState } from 'react'

import type { AnomalyRow } from '@vigia/contracts'

import { Badge, Section } from '@/modules/shared/components/ui'
import type { IndicatorInfo } from '@/modules/shared/hooks'
import { formatNumber, plural, severityOf } from '@/modules/shared/utils'

const ANOMALY_PREVIEW = 10

// Tabla de semanas anómalas ordenadas por desvío, con su severidad
export function AnomaliesCard({
  anomalies,
  flagged,
  info,
}: {
  anomalies: ReadonlyArray<AnomalyRow>
  flagged: ReadonlyArray<AnomalyRow>
  info: IndicatorInfo
}) {
  const [showAll, setShowAll] = useState(false)
  const sorted = [...flagged].sort(
    (left, right) => Math.abs(Number(right.robust_z)) - Math.abs(Number(left.robust_z)),
  )
  const visible = showAll ? sorted : sorted.slice(0, ANOMALY_PREVIEW)

  return (
    <Section title="Semanas fuera de lo esperado">
      <div className="card-sub">
        {flagged.length} {plural(flagged.length, 'semana')} con valores muy por encima o por debajo
        de lo habitual para esa época del año, de la más a la menos marcada.
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
                  <th className="num">{info.label}</th>
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
                        <Badge tone={severity.tone}>{severity.label}</Badge>
                      </td>
                      <td>{row.department}</td>
                      <td>
                        S{row.epi_week} de {row.year}
                      </td>
                      <td className="num strong">{formatNumber(row.cases, info.decimals)}</td>
                      <td className="num">{formatNumber(row.seasonal_baseline, info.decimals)}</td>
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
