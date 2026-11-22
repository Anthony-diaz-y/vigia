import type { UploadDto } from '@vigia/contracts'

import { Badge, Section } from '@/modules/shared/components/ui'
import { UPLOAD_STATUS_LABELS } from '@/modules/shared/constants'
import { formatNumber, plural } from '@/modules/shared/utils'

// Tabla de archivos cargados con su estado y conteo de filas
export function IngestionTable({ uploads }: { uploads: ReadonlyArray<UploadDto> }) {
  const count = uploads.length

  return (
    <Section title={`${count} ${plural(count, 'archivo')} ${plural(count, 'cargado')}`}>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Archivo</th>
              <th>Estado</th>
              <th className="num">Filas leídas</th>
              <th className="num">Válidas</th>
              <th className="num">Descartadas</th>
              <th className="num">Duplicadas</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((row) => (
              <tr key={row.id}>
                <td className="strong">{row.filename}</td>
                <td>
                  <Badge tone={row.status === 'ok' ? 'ok' : 'warn'}>
                    {UPLOAD_STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                </td>
                <td className="num">{formatNumber(row.rows_in)}</td>
                <td className="num strong">{formatNumber(row.rows_valid)}</td>
                <td className="num">{formatNumber(row.rows_dropped)}</td>
                <td className="num">{formatNumber(row.duplicates_collapsed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
