import { Section } from '@/modules/shared/components/ui'

import {
  formatShare,
  isMissingRow,
  rowCode,
  rowText,
  sumRows,
  type BreakdownRow,
} from '../utils/breakdown'
import { formatValue } from '../utils/format-value'

// Tarjeta compacta para una categoría donde casi todo cae en un valor: lo destaca y lista el resto
export function DominantWidget({
  title,
  rows,
  indicatorId,
  unit,
}: {
  title: string
  rows: ReadonlyArray<BreakdownRow>
  indicatorId: string
  unit: string
}) {
  const total = sumRows(rows)
  const top = rows[0]
  const rest = rows.slice(1)
  const code = top ? rowCode(top) : null

  return (
    <Section
      title={title.replace(/_/g, ' ')}
      subtitle={unit}
      level={3}
      className="tb-card prop-card"
    >
      {top && (
        <p className="prop-figure">
          <strong>{formatShare(top.value, total)}</strong>
          <span>
            en «<b>{rowText(top)}</b>»{code && <em className="prop-code"> · código {code}</em>}
          </span>
          <small>
            {formatValue(top.value, indicatorId)} de {formatValue(total, indicatorId)}
          </small>
        </p>
      )}
      {rest.length > 0 && (
        <ul className="prop-legend prop-rest" aria-label="Los demás valores">
          {rest.map((row) => (
            <li key={row.name} className={isMissingRow(row) ? 'is-missing' : ''}>
              <span
                className={`prop-dot ${isMissingRow(row) ? 'prop-missing' : 'prop-b'}`}
                aria-hidden="true"
              />
              <span className="prop-name" title={rowCode(row) ? `Código ${row.name}` : undefined}>
                {rowText(row)}
              </span>
              <span className="prop-num">{formatValue(row.value, indicatorId)}</span>
              <span className="prop-pct">{formatShare(row.value, total)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
