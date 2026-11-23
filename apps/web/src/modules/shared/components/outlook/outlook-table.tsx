import type { OutlookDto } from '@vigia/contracts'

import { formatNumber, plural } from '../../utils'

import { Trend } from './trend'

const OUTLOOK_TABLE_ROWS = 5

// Tabla con la proyección de los departamentos principales y su cambio anual
export function OutlookTable({ outlook }: { outlook: OutlookDto }) {
  const rows = outlook.departments.slice(0, OUTLOOK_TABLE_ROWS)
  const firstYear = outlook.total.projection[0]?.year
  const lastYear = outlook.total.projection.at(-1)?.year
  const rest = outlook.departments.length - rows.length

  return (
    <div className="outlook-table-wrap">
      <table className="outlook-table">
        <thead>
          <tr>
            <th scope="col">Departamento</th>
            <th scope="col">{firstYear}</th>
            <th scope="col">{lastYear}</th>
            <th scope="col">Cambio anual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.department}>
              <th scope="row">{row.department}</th>
              <td>{formatNumber(row.projection[0]?.p50)}</td>
              <td>{formatNumber(row.projection.at(-1)?.p50)}</td>
              <td>
                <Trend value={row.annual_change_pct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rest > 0 && (
        <p className="text-xs text-muted">
          y {rest} {plural(rest, 'departamento')} más con valores menores.
        </p>
      )}
    </div>
  )
}
