import { Section } from '@/modules/shared/components/ui'

import { formatValue } from '../utils/format-value'

const MAX_LABELS = 14

// Mapa de calor de lugares por periodo; más oscuro, mayor valor del indicador
export function HeatmapWidget({
  title,
  rows,
  columns,
  values,
  indicatorId,
}: {
  title: string
  rows: ReadonlyArray<string>
  columns: ReadonlyArray<string>
  values: ReadonlyArray<ReadonlyArray<number | null>>
  indicatorId: string
}) {
  const filled = values.flat().filter((value): value is number => value !== null)
  const min = indicatorId.startsWith('mean:')
    ? filled.reduce((low, value) => Math.min(low, value), Infinity)
    : 0
  const max = filled.reduce((high, value) => Math.max(high, value), 0)
  const span = max - min || 1
  const step = Math.max(1, Math.ceil(columns.length / MAX_LABELS))

  return (
    <Section title={title}>
      <div className="card-sub">
        Cada fila es un lugar y cada cuadro un periodo. Más oscuro, mayor valor.
      </div>
      <div className="overflow-x-auto" aria-label={title}>
        <div
          className="heatmap-grid"
          style={{
            gridTemplateColumns: `132px repeat(${columns.length}, minmax(14px, 1fr))`,
            minWidth: 132 + columns.length * 16,
          }}
        >
          <div className="hm-corner" />
          {columns.map((column, index) => (
            <div key={column} className="hm-xlabel" title={column}>
              {index % step === 0 ? column.slice(-3).replace(/^-/, '') : ''}
            </div>
          ))}
          {rows.map((row, rowIndex) => (
            <div key={row} className="contents">
              <div className="hm-ylabel" title={row}>
                {row}
              </div>
              {columns.map((column, columnIndex) => {
                const value = values[rowIndex]?.[columnIndex] ?? null
                const alpha = value === null ? 0 : 0.08 + 0.9 * Math.sqrt((value - min) / span)
                return (
                  <span
                    key={column}
                    className="hm-cell"
                    title={`${row}, ${column}: ${value === null ? 'sin datos' : formatValue(value, indicatorId)}`}
                    style={{ background: `rgba(var(--heat), ${alpha.toFixed(3)})` }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="hm-legend">
        <span className="text-muted">{formatValue(min, indicatorId)}</span>
        <span className="hm-legend-bar" />
        <span className="text-muted">{formatValue(max, indicatorId)}</span>
      </div>
    </Section>
  )
}
