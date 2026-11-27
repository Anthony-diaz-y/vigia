'use client'

import { useState } from 'react'

import { ConfirmDialog, ErrorBanner } from '@/modules/shared/components/ui'
import { EMPTY_UPLOADS } from '@/modules/shared/constants'
import { useClearUploads, useSession, useUploads } from '@/modules/shared/hooks'
import { errorMessage, formatNumber, plural } from '@/modules/shared/utils'

import { IngestionTable } from './ingestion-table'

// Página de archivos: lista de cargas y, para administradores, el borrado de todos los datos
export function ArchivosPage() {
  const { data: uploads = EMPTY_UPLOADS } = useUploads()
  const { user } = useSession()
  const clearMutation = useClearUploads()
  const [confirming, setConfirming] = useState(false)
  const rows = uploads.reduce((sum, upload) => sum + upload.rows_in, 0)

  return (
    <>
      <IngestionTable uploads={uploads} />
      {user?.role === 'admin' && (
        <section className="card danger-zone">
          <div>
            <h2 className="section-title">Borrar todos los datos</h2>
            <p className="card-sub">
              Elimina los archivos cargados y todo lo calculado a partir de ellos. No se puede
              deshacer.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirming(true)}
            disabled={uploads.length === 0}
          >
            Borrar todo
          </button>
          {clearMutation.isError && <ErrorBanner message={errorMessage(clearMutation.error)} />}
        </section>
      )}
      {confirming && (
        <ConfirmDialog
          title="¿Borrar todos los datos?"
          confirmLabel="Sí, borrar todo"
          busy={clearMutation.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            clearMutation.mutate(undefined, { onSettled: () => setConfirming(false) })
          }
        >
          Se eliminarán {uploads.length} {plural(uploads.length, 'archivo')} con{' '}
          {formatNumber(rows)} filas, junto con sus tableros, alertas y pronósticos.
        </ConfirmDialog>
      )}
    </>
  )
}
