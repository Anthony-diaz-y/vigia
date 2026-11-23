import type { HeatmapResponse } from '@vigia/contracts'

import { Section } from '@/modules/shared/components/ui'
import type { IndicatorInfo } from '@/modules/shared/hooks'
import { formatNumber, plural } from '@/modules/shared/utils'

// Mapa de calor de casos por departamento y semana del año elegido
export function HeatmapCard({
  heatmap,
  peak,
  year,
  info,
}: {
  heatmap: HeatmapResponse | null
  peak: number
  year: number
  info: IndicatorInfo
}) {
  const heatMax = Math.max(1, peak)
  const rows = heatmap
    ? heatmap.geographies
        .map((geo, index) => ({ geo, values: heatmap.values[index] ?? [] }))
        .filter((row) => row.values.some((value) => value > 0))
    : []
  const hidden = heatmap ? heatmap.geographies.length - rows.length : 0

  return (
    <Section title={`${info.label} por semana en ${year}`}>
      <div className="card-sub">
        Cada fila es un departamento y cada cuadro una semana. Más oscuro, mayor valor.
      </div>
      {heatmap ? (
        <>
          <div className="overflow-x-auto" aria-label={`Mapa de calor de ${info.unit} por semana`}>
            <div
              className="heatmap-grid"
              style={{
                gridTemplateColumns: `132px repeat(${heatmap.weeks.length}, minmax(14px, 1fr))`,
                minWidth: 132 + heatmap.weeks.length * 16,
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
                        title={`${geo} · semana ${heatmap.weeks[cellIndex]}: ${formatNumber(value, info.decimals)} ${info.unit}`}
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
            <span className="text-muted">
              {formatNumber(heatMax, info.decimals)} {info.unit}
            </span>
          </div>
          {hidden > 0 && (
            <div className="card-note">
              Se omiten {hidden} {plural(hidden, 'departamento')} sin registros.
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Sin datos para el año seleccionado.</p>
      )}
    </Section>
  )
}
