'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { DatasetColumnDto, PreviewColumnDto, UploadPreview } from '@vigia/contracts'

import type { UploadReview } from '../../services/uploads.service'
import { formatNumber } from '../../utils'
import { CloseIcon, ErrorBanner, LockIcon, PencilIcon, Select, type SelectOption } from '../ui'

type Role = DatasetColumnDto['role']
type Level = NonNullable<DatasetColumnDto['level']>

const SINGLE_ROLES: ReadonlySet<Role> = new Set(['date', 'year', 'week', 'month', 'count'])
const UNUSED_ROLES: ReadonlySet<Role> = new Set(['identifier', 'ignore'])
const TIME_ROLES: ReadonlySet<Role> = new Set(['date', 'year', 'week', 'month'])

// Quita del preview los ejemplos y el motivo para quedarse con la columna que se envía
function toColumn({ samples: _samples, reason: _reason, ...column }: PreviewColumnDto) {
  return column
}

// Cambia el rol de una columna y libera el mismo rol (o el mismo nivel de lugar) en las demás
function assignRole(
  columns: readonly DatasetColumnDto[],
  name: string,
  role: Role,
  level: Level | null,
): DatasetColumnDto[] {
  const nextLevel = role === 'place' ? (level ?? 'department') : null
  return columns.map((column) => {
    if (column.name === name) {
      const keepsField = role === 'category' || role === 'measure'
      return { ...column, role, level: nextLevel, field: keepsField ? column.field : null }
    }
    const clashes =
      (SINGLE_ROLES.has(role) && column.role === role) ||
      (role === 'place' && column.role === 'place' && column.level === nextLevel)
    return clashes ? { ...column, role: 'ignore', level: null, field: null } : column
  })
}

// Diálogo para revisar qué es cada columna del archivo y cómo la usará Vigia
export function MappingDialog({
  preview,
  filename,
  busy,
  onCancel,
  onConfirm,
}: {
  preview: UploadPreview
  filename: string
  busy: boolean
  onCancel: () => void
  onConfirm: (review: UploadReview) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pressedBackdrop = useRef(false)
  const [columns, setColumns] = useState(() => preview.columns.map(toColumn))
  const [title, setTitle] = useState(preview.title)
  const [topic, setTopic] = useState(preview.topic)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const roleOptions: SelectOption<Role>[] = useMemo(
    () =>
      preview.roles.map((role) => ({
        value: role.id as Role,
        label: role.label,
        hint: role.description,
      })),
    [preview.roles],
  )
  const levelOptions: SelectOption<Level>[] = useMemo(
    () => preview.place_levels.map((level) => ({ value: level.id as Level, label: level.label })),
    [preview.place_levels],
  )

  const roles = new Set(columns.map((column) => column.role))
  const useful = columns.some((column) => !UNUSED_ROLES.has(column.role))
  const personal = new Set(preview.pii_detected)
  const notes = [
    [...TIME_ROLES].some((role) => roles.has(role))
      ? null
      : 'Sin fecha no habrá evolución en el tiempo ni pronóstico.',
    roles.has('place') ? null : 'Sin lugar no habrá ranking ni mapa por zona.',
    roles.has('count') ? null : 'Sin columna de cantidad, cada fila cuenta como un registro.',
  ].filter((note): note is string => note !== null)

  const close = () => {
    if (!busy) {
      onCancel()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal map-dialog"
      aria-labelledby="mapping-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) {
          close()
        }
        pressedBackdrop.current = false
      }}
    >
      <header className="map-header">
        <div className="min-w-0">
          <h2 id="mapping-title" className="text-lg font-semibold text-title">
            Revisa cómo se leerá el archivo
          </h2>
          <p className="mt-1 text-sm text-muted">
            <strong className="text-text">{filename}</strong>, {formatNumber(preview.rows)} filas.{' '}
            {preview.suggested_by === 'deepseek'
              ? 'La IA sugirió un nombre y un tipo para cada columna. Puedes cambiar ambos.'
              : 'Sugerimos un nombre y un tipo para cada columna. Puedes cambiar ambos.'}
          </p>
        </div>
        <button
          type="button"
          className="map-close"
          aria-label="Cerrar"
          onClick={close}
          disabled={busy}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="map-body">
        <div className="map-meta">
          <label className="map-field">
            <span>Nombre del dataset</span>
            <input
              className="input"
              value={title}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="map-field">
            <span>Tema</span>
            <input
              className="input"
              value={topic}
              maxLength={40}
              placeholder="Por ejemplo: dengue, anemia, egresos"
              onChange={(event) => setTopic(event.target.value)}
            />
          </label>
        </div>

        {personal.size > 0 && (
          <p className="map-privacy">
            <LockIcon />
            <span>
              Datos personales ({preview.pii_detected.join(', ')}): se aceptan, pero no se guardan
              ni se envían a la IA.
            </span>
          </p>
        )}
        {!useful && (
          <ErrorBanner
            className="mt-4"
            message="Elige al menos una columna para usar: ahora todas están como identificador o sin uso."
          />
        )}

        <div className="map-list" role="table" aria-label="Columnas del archivo">
          <div className="map-row map-head" role="row">
            <span role="columnheader">Nombre en Vigia (puedes editarlo)</span>
            <span role="columnheader">Ejemplos</span>
            <span role="columnheader">Tipo de dato</span>
          </div>
          {columns.map((column, index) => {
            const suggested = preview.columns[index]
            const unchanged = suggested?.role === column.role && suggested.level === column.level
            const locked = personal.has(column.name)
            return (
              <div
                key={column.name}
                className={`map-row${UNUSED_ROLES.has(column.role) ? ' is-unused' : ''}`}
                role="row"
              >
                <div role="cell" className="min-w-0">
                  <label className="map-label">
                    <input
                      className="map-label-input"
                      value={column.label}
                      maxLength={60}
                      placeholder={column.name}
                      aria-label={`Nombre en Vigia de la columna ${column.name}`}
                      onChange={(event) => {
                        const label = event.target.value
                        setColumns((all) =>
                          all.map((item) =>
                            item.name === column.name ? { ...item, label } : item,
                          ),
                        )
                      }}
                    />
                    <PencilIcon />
                  </label>
                  <div className="map-name" title={column.name}>
                    Columna del archivo: <code>{column.name}</code>
                  </div>
                </div>
                <div role="cell" className="map-samples">
                  {suggested && suggested.samples.length > 0
                    ? suggested.samples.map((sample) => (
                        <span key={sample} className="map-sample" title={sample}>
                          {sample}
                        </span>
                      ))
                    : '—'}
                </div>
                <div role="cell" className="map-choice">
                  <Select
                    className="is-boxed"
                    label={`Tipo de dato de la columna ${column.name}`}
                    value={column.role}
                    options={roleOptions}
                    disabled={locked}
                    onChange={(role) =>
                      setColumns((all) => assignRole(all, column.name, role, null))
                    }
                  />
                  {column.role === 'place' && (
                    <Select
                      className="is-boxed"
                      label={`Nivel de lugar de ${column.name}`}
                      value={column.level ?? 'department'}
                      options={levelOptions}
                      onChange={(level) =>
                        setColumns((all) => assignRole(all, column.name, 'place', level))
                      }
                    />
                  )}
                  {unchanged && suggested?.reason && (
                    <p className="map-reason">{suggested.reason}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {notes.length > 0 && (
          <ul className="map-notes">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>

      <footer className="map-footer">
        <button type="button" className="btn" onClick={close} disabled={busy}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onConfirm({ columns, title: title.trim(), topic: topic.trim() })}
          disabled={busy || !useful}
        >
          {busy ? 'Cargando…' : 'Confirmar y cargar'}
        </button>
      </footer>
    </dialog>
  )
}
