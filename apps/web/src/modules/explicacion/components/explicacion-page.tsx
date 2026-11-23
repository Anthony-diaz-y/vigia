'use client'

import { useMemo, useState } from 'react'

import type { ExplainResponse } from '@vigia/contracts'

import { Badge, ErrorBanner, Kpi, LoadingState, Section } from '@/modules/shared/components/ui'
import { useDashboardFilters } from '@/modules/shared/contexts'
import { errorMessage, formatNumber } from '@/modules/shared/utils'

import { useExplanation } from '../hooks/use-explanation'
import { dominantDriver } from '../utils/drivers'

// Página de explicación: factores que mueven el pronóstico y acciones por departamento
export function ExplicacionPage() {
  const { uploadId, indicator } = useDashboardFilters()
  const { data: explain, isError, error } = useExplanation(uploadId, indicator)

  if (isError) {
    return <ErrorBanner message={errorMessage(error)} />
  }

  if (!explain) {
    return <LoadingState label="Preparando la explicación…" />
  }

  if (explain.drivers.length === 0) {
    return (
      <Section title="Explicación">
        <p className="text-sm text-muted">
          Todavía no hay factores explicables: se necesita más historia semanal por lugar.
        </p>
      </Section>
    )
  }

  return <ExplanationContent explain={explain} />
}

// Contenido de la explicación con selector de departamento, factores, acciones y narrativa
function ExplanationContent({ explain }: { explain: ExplainResponse }) {
  const departments = useMemo(
    () => [...new Set(explain.drivers.map((row) => row.department))],
    [explain],
  )
  const [selected, setSelected] = useState<string | null>(null)
  const activeDepartment = selected && departments.includes(selected) ? selected : departments[0]

  const drivers = useMemo(() => {
    if (!activeDepartment) {
      return []
    }
    return explain.drivers
      .filter((row) => row.department === activeDepartment)
      .sort((left, right) => left.rank - right.rank)
  }, [explain, activeDepartment])

  const maxShap = drivers.reduce((peak, row) => Math.max(peak, Number(row.abs_mean_shap) || 0), 0)
  const narrative = explain.narratives.find((item) => item.department === activeDepartment)
  const perDepartment =
    departments.length === 0 ? 0 : Math.round(explain.drivers.length / departments.length)

  const dominant = useMemo(() => dominantDriver(explain.drivers), [explain])

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Departamentos" value={departments.length} delta="con explicación disponible" />
        <Kpi label="Factores analizados" value={perDepartment} delta="por departamento" />
        <Kpi
          label="Factor que más pesa"
          value={dominant ?? '—'}
          small
          delta="el más frecuente en primer lugar"
        />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Departamento">
        {departments.map((department) => (
          <button
            key={department}
            type="button"
            role="tab"
            aria-selected={activeDepartment === department}
            className={`dept-pill${activeDepartment === department ? ' active' : ''}`}
            onClick={() => setSelected(department)}
          >
            {department}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={`Qué mueve el pronóstico en ${activeDepartment ?? '—'}`}>
          <div className="card-sub">
            Barra más larga, más peso. En ámbar, los factores que empujan el indicador hacia arriba.
          </div>
          <div className="flex flex-col gap-4">
            {drivers.map((row) => {
              const width = maxShap ? (row.abs_mean_shap / maxShap) * 100 : 0
              const up = row.direction === 'up'
              return (
                <div key={row.feature}>
                  <div className="driver-head">
                    <span className="driver-name">
                      <span className="driver-rank">{row.rank}</span>
                      {row.driver}
                    </span>
                    <Badge tone={up ? 'warn' : 'ok'}>{up ? '↑ al alza' : '↓ a la baja'}</Badge>
                  </div>
                  <div className="driver-track">
                    <div
                      className={`driver-fill ${up ? 'up' : 'down'}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="driver-value">peso {formatNumber(row.abs_mean_shap, 2)}</div>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Qué hacer con cada factor">
          <div className="card-sub">Acciones preventivas de una tabla fija revisada.</div>
          <ul className="flex flex-col">
            {drivers.map((row) => (
              <li className="action-item" key={`action-${row.feature}`}>
                <div className="action-head">
                  <span className="driver-rank">{row.rank}</span>
                  <span>{row.driver}</span>
                </div>
                <p className="action-text">{row.action}</p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {narrative && (
        <Section title={`En palabras simples: ${activeDepartment}`}>
          <div className="narrative mt-2 whitespace-pre-line">{narrative.text}</div>
          <p className="mt-3 text-xs text-muted">
            {narrative.source === 'deepseek'
              ? 'Redactado por IA (DeepSeek) sobre datos agregados.'
              : 'Texto automático sobre datos agregados.'}{' '}
            No reemplaza la revisión del equipo de epidemiología.
          </p>
        </Section>
      )}
    </>
  )
}
