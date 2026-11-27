'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Diálogo de confirmación accesible para acciones que no se pueden deshacer
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="modal confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) {
          onCancel()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel()
        }
      }}
    >
      <div className="confirm-body">
        <h2 id="confirm-title" className="text-lg font-semibold text-title">
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel} disabled={busy} autoFocus>
            Cancelar
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Un momento…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
