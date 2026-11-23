import { Section } from '@/modules/shared/components/ui'

import { formatValue } from '../utils/format-value'

// Barras horizontales para rankings por lugar y desgloses por categoría
export function BarsWidget({
  title,
  rows,
  indicatorId,
}: {
  title: string
  rows: ReadonlyArray<{ name: string; value: number }>
  indicatorId: string
}) {
  const max = rows.reduce((peak, row) => Math.max(peak, row.value), 0)
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const shares = !indicatorId.startsWith('mean:') && total > 0

  return (
    <Section title={title}>
      <div className="mt-3 flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.name} className="rank-row">
            <span className="rank-name" title={row.name}>
              {row.name}
            </span>
            <div className="rank-track">
              <div
                className="rank-fill"
                style={{ width: `${max ? Math.max((row.value / max) * 100, 1) : 0}%` }}
              />
            </div>
            <span className="rank-value">
              {formatValue(row.value, indicatorId)}
              {shares && (
                <span className="rank-share">{((row.value / total) * 100).toFixed(1)} %</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </Section>
  )
}
