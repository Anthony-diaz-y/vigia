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

// Clase de color de un tramo: el primero resalta, el segundo es neutro y el "Sin dato" va apagado
function segmentClass(row: BreakdownRow, index: number): string {
  return isMissingRow(row) ? 'prop-missing' : index === 0 ? 'prop-a' : 'prop-b'
}

// Tarjeta compacta para sí/no o dos valores: la cifra principal, una barra apilada y su leyenda
export function ProportionWidget({
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
  const head = rows.find((row) => row.name === 'Sí') ?? rows.find((row) => !isMissingRow(row))
  const ordered = head ? [head, ...rows.filter((row) => row !== head)] : [...rows]
  const code = head ? rowCode(head) : null

  return (
    <Section
      title={title.replace(/_/g, ' ')}
      subtitle={unit}
      level={3}
      className="tb-card prop-card"
    >
      {head && (
        <p className="prop-figure">
          <strong>
            {formatValue(head.value, indicatorId)} de {formatValue(total, indicatorId)}
          </strong>
          <span>
            <b>{formatShare(head.value, total)}</b> {rowText(head)}
            {code && <em className="prop-code"> · código {code}</em>}
          </span>
        </p>
      )}
      <div
        className="prop-bar"
        role="img"
        aria-label={ordered
          .map((row) => `${rowText(row)}: ${formatShare(row.value, total)}`)
          .join(', ')}
      >
        {ordered
          .filter((row) => row.value > 0)
          .map((row) => (
            <span
              key={row.name}
              className={`prop-seg ${segmentClass(row, ordered.indexOf(row))}`}
              style={{ width: `${(row.value / total) * 100}%` }}
              title={`${rowText(row)}: ${formatValue(row.value, indicatorId)} (${formatShare(row.value, total)})`}
            />
          ))}
      </div>
      <ul className="prop-legend">
        {ordered.map((row, index) => (
          <li key={row.name} className={isMissingRow(row) ? 'is-missing' : ''}>
            <span className={`prop-dot ${segmentClass(row, index)}`} aria-hidden="true" />
            <span className="prop-name" title={rowCode(row) ? `Código ${row.name}` : undefined}>
              {rowText(row)}
            </span>
            <span className="prop-num">{formatValue(row.value, indicatorId)}</span>
            <span className="prop-pct">{formatShare(row.value, total)}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
