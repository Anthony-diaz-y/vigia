'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { UploadPreview } from '@vigia/contracts'

import { ErrorBanner, Select, type SelectOption } from '../ui'

// Mapeo sugerido por la API para cada columna canónica, vacío si no hay sugerencia
function initialMapping(preview: UploadPreview): Record<string, string> {
  return Object.fromEntries(
    preview.canonical_columns.map((canonical) => [canonical, preview.mapping[canonical] ?? '']),
  )
}

// Diálogo para revisar y ajustar el mapeo de columnas antes de ingerir el archivo
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
  const [mapping, setMapping] = useState(() => initialMapping(preview))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const columnOptions: SelectOption<string>[] = useMemo(
    () => [
      { value: '', label: '(sin mapear)' },
      ...preview.columns.map((column) => ({ value: column, label: column })),
    ],
    [preview.columns],
  )

  const missingRequired = useMemo(
    () => preview.required.filter((required) => !mapping[required]),
    [preview.required, mapping],
  )

  // Envía solo las columnas mapeadas al confirmar
  const confirm = () =>
    onConfirm(Object.fromEntries(Object.entries(mapping).filter(([, source]) => source)))

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
        <ErrorBanner
          className="mb-3"
          message={`El archivo contiene columnas de datos personales (${preview.pii_detected.join(', ')}) y no puede ingerirse.`}
        />
      )}
      {missingRequired.length > 0 && (
        <ErrorBanner
          className="mb-3"
          message={`Faltan columnas requeridas: ${missingRequired.join(', ')}`}
        />
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
                  <Select
                    className="is-boxed"
                    label={`Columna del archivo para ${canonical}`}
                    value={mapping[canonical] ?? ''}
                    options={columnOptions}
                    onChange={(value) =>
                      setMapping((previous) => ({
                        ...previous,
                        [canonical]: value,
                      }))
                    }
                  />
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
