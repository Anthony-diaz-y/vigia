import { Section } from '@/modules/shared/components/ui'
import { formatNumber, plural } from '@/modules/shared/utils'

import { formatShare, isMissingRow, rowCode, rowText, type BreakdownRow } from '../utils/breakdown'
import { formatValue } from '../utils/format-value'

const MAX_NAMED = 8
const OTHERS_NAME = /^(otros|resto|demás valores|otros \(agrupados\))$/i

type Row = BreakdownRow

// Separa los grupos con nombre del "Otros" que arma la API y recorta a los 8 más altos
function splitRows(
  everything: ReadonlyArray<Row>,
  additive: boolean,
): { named: Row[]; others: Row | null; missing: Row | null; trimmed: boolean } {
  const missing = everything.find(isMissingRow) ?? null
  const rows = everything.filter((row) => !isMissingRow(row))
  const last = rows[rows.length - 1]
  const apiOthers = rows.length > 1 && last && OTHERS_NAME.test(last.name.trim()) ? last : null
  const all = apiOthers ? rows.slice(0, -1) : [...rows]
  const named = all.slice(0, MAX_NAMED)
  const dropped = all.slice(MAX_NAMED)
  const trimmed = apiOthers !== null || dropped.length > 0
  // Un promedio no se puede sumar: al recortar grupos, "Otros" no se calcula
  if (!additive || !trimmed) {
    return { named, others: null, missing, trimmed }
  }
  const value = dropped.reduce((sum, row) => sum + row.value, apiOthers?.value ?? 0)
  return { named, others: { name: apiOthers?.name ?? 'Otros', value }, missing, trimmed }
}

// Barras horizontales para rankings por lugar y desgloses por categoría
export function BarsWidget({
  title,
  rows,
  indicatorId,
}: {
  title: string
  rows: ReadonlyArray<Row>
  indicatorId: string
}) {
  const additive = !indicatorId.startsWith('mean:')
  const { named, others, missing, trimmed } = splitRows(rows, additive)
  const peak = named.reduce((high, row) => Math.max(high, row.value), 0)
  const total = [...named, ...(others ? [others] : []), ...(missing ? [missing] : [])].reduce(
    (sum, row) => sum + row.value,
    0,
  )
  const showShares = additive && total > 0

  let subtitle = `${formatNumber(named.length)} ${plural(named.length, 'grupo')}, de mayor a menor`
  if (trimmed) {
    subtitle = additive
      ? `Los ${MAX_NAMED} más altos; el resto va en «${others?.name ?? 'Otros'}»`
      : `Los ${MAX_NAMED} con el valor más alto`
  }

  return (
    <Section title={title.replace(/_/g, ' ')} subtitle={subtitle} level={3} className="tb-card">
      <ol className="bar-list">
        {named.map((row, index) => (
          <li key={row.name} className="bar-row">
            <span className="bar-index" aria-hidden="true">
              {index + 1}
            </span>
            <span className="bar-name" title={rowCode(row) ? `${row.name} · código` : row.name}>
              {rowText(row)}
              {rowCode(row) && <span className="bar-code"> · {row.name}</span>}
            </span>
            <span className="bar-value">{formatValue(row.value, indicatorId)}</span>
            <span className="bar-share">{showShares ? formatShare(row.value, total) : ''}</span>
            <div className="bar-track" aria-hidden="true">
              <div
                className="bar-fill"
                style={{ width: `${peak ? Math.max((row.value / peak) * 100, 1.5) : 0}%` }}
              />
            </div>
          </li>
        ))}
        {others && (
          <li className="bar-row bar-others">
            <span className="bar-index" aria-hidden="true" />
            <span className="bar-name" title={others.name}>
              {others.name}
            </span>
            <span className="bar-value">{formatValue(others.value, indicatorId)}</span>
            <span className="bar-share">{showShares ? formatShare(others.value, total) : ''}</span>
          </li>
        )}
        {missing && (
          <li className="bar-row bar-missing">
            <span className="bar-index" aria-hidden="true" />
            <span className="bar-name" title="Valores vacíos o sin información">
              {missing.name}
            </span>
            <span className="bar-value">{formatValue(missing.value, indicatorId)}</span>
            <span className="bar-share">{showShares ? formatShare(missing.value, total) : ''}</span>
            <div className="bar-track" aria-hidden="true">
              <div
                className="bar-fill"
                style={{ width: `${peak ? Math.max((missing.value / peak) * 100, 1.5) : 0}%` }}
              />
            </div>
          </li>
        )}
      </ol>
    </Section>
  )
}
