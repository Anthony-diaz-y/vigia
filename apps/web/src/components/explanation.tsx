'use client'

import { useMemo, useState } from 'react'

import type { ExplainResponse } from '@vigia/contracts'

import { formatNumber } from '@/lib/format'

import { Badge, Kpi, Section } from './ui'

export function ExplanationView({ explain }: { explain: ExplainResponse }) {
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
  const narrative = explain.narratives[departments.indexOf(activeDepartment ?? '')]
  const perDepartment =
    departments.length === 0 ? 0 : Math.round(explain.drivers.length / departments.length)

  const dominant = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of explain.drivers) {
      if (row.rank === 1) {
        counts.set(row.driver, (counts.get(row.driver) ?? 0) + 1)
      }
    }
    let best = ''
    let bestCount = 0
    for (const [name, count] of counts) {
      if (count > bestCount) {
        best = name
        bestCount = count
      }
    }
    return best
  }, [explain])

  const sources = [...new Set(explain.narratives.map((item) => item.source))]

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Departamentos" value={departments.length} delta="con explicación disponible" />
        <Kpi label="Impulsores" value={perDepartment} delta="por departamento" />
        <Kpi label="Driver dominante" value={dominant || '—'} small delta="señal más frecuente" />
        <Kpi
          label="Narrativa"
          value={sources.length === 0 ? '—' : sources.join(' / ')}
          small
          delta="texto generado sobre datos agregados"
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
        <Section title={`Impulsores · ${activeDepartment ?? '—'}`}>
          <div className="card-sub">
            Contribución media de cada factor al pronóstico, en valor absoluto (escala SHAP sobre el
            modelo lineal). Una barra más larga implica mayor peso en la explicación.
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
                  <div className="driver-value">
                    contribución {formatNumber(row.abs_mean_shap, 2)}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Acciones recomendadas">
          <div className="card-sub">
            Tabla determinista que traduce cada impulsor en una acción preventiva. El modelo no
            decide: solo ordena y explica.
          </div>
          <ul className="flex flex-col gap-3">
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
        <Section title={`Lectura · ${activeDepartment}`}>
          <div className="narrative">
            <span className="text-muted">[{narrative.source}]</span> {narrative.text}
          </div>
          <div className="card-note">
            El texto se redacta sobre un resumen agregado; no aporta cifras nuevas ni reemplaza la
            revisión del equipo de epidemiología.
          </div>
        </Section>
      )}
    </>
  )
}
