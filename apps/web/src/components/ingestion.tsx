'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { UploadDto, UploadPreview } from '@vigia/contracts'

import { Badge, Section, UPLOAD_STATUS_LABELS } from './ui'

export function IngestionTable({ uploads }: { uploads: ReadonlyArray<UploadDto> }) {
  return (
    <Section title={`Archivos ingeridos (${uploads.length})`}>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Archivo</th>
              <th>Estado</th>
              <th>Filas leídas</th>
              <th>Válidas</th>
              <th>Descartadas</th>
              <th>Duplicadas</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((row) => (
              <tr key={row.id}>
                <td>{row.filename}</td>
                <td>
                  <Badge tone={row.status === 'ok' ? 'ok' : 'warn'}>
                    {UPLOAD_STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                </td>
                <td>{row.rows_in}</td>
                <td>{row.rows_valid}</td>
                <td>{row.rows_dropped}</td>
                <td>{row.duplicates_collapsed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

export function MappingDialog({
  preview,
  busy,
  onCancel,
  onConfirm,
}: {
  preview: UploadPreview
  busy: boolean
  onCancel: () => void
  onConfirm: (mapping: Record<string, string>) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})

  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const canonical of preview.canonical_columns) {
      initial[canonical] = preview.mapping[canonical] ?? ''
    }
    setMapping(initial)
  }, [preview])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const missingRequired = useMemo(
    () => preview.required.filter((required) => !mapping[required]),
    [preview.required, mapping],
  )

  const confirm = () => {
    const payload: Record<string, string> = {}
    for (const [canonical, source] of Object.entries(mapping)) {
      if (source) {
        payload[canonical] = source
      }
    }
    onConfirm(payload)
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="mapping-title"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <h2 id="mapping-title" className="text-lg font-semibold text-title">
        Revisar mapeo de columnas
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        Confirmá cómo se mapean las columnas del archivo a las canónicas antes de ingestar. Podés
        reasignar cualquier columna.
      </p>

      {preview.pii_detected.length > 0 && (
        <div
          role="alert"
          className="mb-3 rounded-[var(--radius-sm)] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          El archivo contiene columnas de datos personales ({preview.pii_detected.join(', ')}) y no
          puede ingerirse.
        </div>
      )}
      {missingRequired.length > 0 && (
        <div
          role="alert"
          className="mb-3 rounded-[var(--radius-sm)] border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          Faltan columnas requeridas: {missingRequired.join(', ')}
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Columna canónica</th>
              <th>Columna del archivo</th>
            </tr>
          </thead>
          <tbody>
            {preview.canonical_columns.map((canonical) => (
              <tr key={canonical}>
                <td>
                  {canonical}
                  {preview.required.includes(canonical) && <span className="text-muted"> *</span>}
                </td>
                <td>
                  <select
                    className="file-select w-full"
                    value={mapping[canonical] ?? ''}
                    aria-label={`Columna del archivo para ${canonical}`}
                    onChange={(event) =>
                      setMapping((previous) => ({
                        ...previous,
                        [canonical]: event.target.value,
                      }))
                    }
                  >
                    <option value="">(sin mapear)</option>
                    {preview.columns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.unmapped_columns.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          Columnas del archivo sin mapear: {preview.unmapped_columns.join(', ')}
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={confirm}
          disabled={busy || missingRequired.length > 0 || preview.pii_detected.length > 0}
        >
          {busy ? 'Ingestando…' : 'Confirmar e ingestar'}
        </button>
      </div>
    </dialog>
  )
}
