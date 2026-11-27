'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  summarizeDashboard,
  turnOnRole,
  type DatasetColumnDto,
  type PreviewColumnDto,
  type SummaryWidget,
  type UploadPreview,
} from '@vigia/contracts'

import type { UploadReview } from '../../services/uploads.service'
import { formatNumber } from '../../utils'
import {
  BarsIcon,
  CheckIcon,
  CloseIcon,
  ErrorBanner,
  HashIcon,
  LayersIcon,
  LockIcon,
  PencilIcon,
  PinIcon,
  Select,
  SparkIcon,
  TrendIcon,
  WarningIcon,
} from '../ui'
import {
  SINGLE_ROLES,
  fullUseName,
  isUnusedRole,
  parseUse,
  useOf,
  useOptions,
  type Level,
  type Role,
  type Use,
} from './mapping-uses'

type Filter = 'all' | 'on' | 'off'

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'on', label: 'Se usarán' },
  { id: 'off', label: 'No se usarán' },
]

const WIDGET_ICONS: Readonly<Record<SummaryWidget['type'], ReactNode>> = {
  kpis: <BarsIcon />,
  timeseries: <TrendIcon />,
  interannual: <TrendIcon />,
  ranking: <PinIcon />,
  heatmap: <PinIcon />,
  breakdown: <LayersIcon />,
  histogram: <BarsIcon />,
  indicators: <HashIcon />,
  forecast: <SparkIcon />,
}

// Quita del preview los ejemplos, los códigos y el motivo para quedarse con la columna que se envía
function toColumn({
  samples: _samples,
  codes: _codes,
  reason: _reason,
  ...column
}: PreviewColumnDto): DatasetColumnDto {
  return column
}

// Cambia el significado de un código; vacío lo quita, y sin significados la columna no lleva `values`
function withMeaning(column: DatasetColumnDto, code: string, label: string): DatasetColumnDto {
  const { values: current, ...rest } = column
  const values = { ...current }
  if (label.trim() === '') {
    delete values[code]
  } else {
    values[code] = label
  }
  return Object.keys(values).length > 0 ? { ...rest, values } : rest
}

// Códigos que se pueden explicar en una columna: los del archivo o, si no, los que ya tienen significado
function meaningCodes(column: DatasetColumnDto, codes: readonly string[] | undefined): string[] {
  return codes && codes.length > 0 ? [...codes] : Object.keys(column.values ?? {})
}

// Resumen de los significados de una columna: "3 valores con significado"
function meaningSummary(column: DatasetColumnDto): string {
  const filled = Object.values(column.values ?? {}).filter((label) => label.trim() !== '').length
  return filled === 0
    ? 'Significado de los valores (opcional)'
    : `${filled} ${filled === 1 ? 'valor con significado' : 'valores con significado'}`
}

// Lista editable plegada de «código → significado» para una categoría de códigos
function ValueMeanings({
  column,
  codes,
  onChange,
}: {
  column: DatasetColumnDto
  codes: readonly string[]
  onChange: (code: string, label: string) => void
}) {
  return (
    <details className="map-values">
      <summary>{meaningSummary(column)}</summary>
      <div className="map-values-list">
        {codes.map((code) => (
          <label key={code} className="map-value">
            <code title={`Código ${code}`}>{code}</code>
            <input
              className="map-value-input"
              value={column.values?.[code] ?? ''}
              maxLength={60}
              placeholder="Qué significa"
              aria-label={`Significado del valor ${code} de ${displayName(column)}`}
              onChange={(event) => onChange(code, event.target.value)}
            />
          </label>
        ))}
      </div>
    </details>
  )
}

// Cambia el rol de una columna y libera el mismo rol de tiempo (o nivel de lugar) en las demás
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

// Nombre visible de una columna: su nombre en Vigia o, si está vacío, el del archivo
function displayName(column: DatasetColumnDto): string {
  return column.label.trim() || column.name
}

// Tarjeta de un gráfico que tendrá el tablero
function WidgetCard({ widget }: { widget: SummaryWidget }) {
  return (
    <li className="map-widget">
      <span className="map-widget-icon" aria-hidden="true">
        {WIDGET_ICONS[widget.type]}
      </span>
      <div className="min-w-0">
        <h4>
          {widget.title}
          <span className="map-widget-state">
            <CheckIcon /> Incluido
          </span>
        </h4>
        <p>{widget.detail}</p>
        {widget.tags.length > 0 && (
          <div className="map-widget-tags">
            {widget.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </li>
  )
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
  const filterRef = useRef<HTMLDivElement>(null)
  const pressedBackdrop = useRef(false)
  const [columns, setColumns] = useState(() => preview.columns.map(toColumn))
  const [title, setTitle] = useState(preview.title)
  const [topic, setTopic] = useState(preview.topic)
  const [filter, setFilter] = useState<Filter>('all')
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const personal = useMemo(() => new Set(preview.pii_detected), [preview.pii_detected])
  const summary = useMemo(
    () =>
      summarizeDashboard(
        columns.map((column) =>
          personal.has(column.name) ? { ...column, role: 'identifier' as const } : column,
        ),
      ),
    [columns, personal],
  )

  const useful = columns.some((column) => !isUnusedRole(column.role))
  const protectedCount = columns.filter((column) => personal.has(column.name)).length
  const usedCount = columns.filter(
    (column) => !personal.has(column.name) && !isUnusedRole(column.role),
  ).length
  const idleNumbers = columns.filter(
    (column) => column.kind === 'number' && !personal.has(column.name) && isUnusedRole(column.role),
  ).length
  const isOn = (column: DatasetColumnDto) =>
    !personal.has(column.name) && !isUnusedRole(column.role)
  const visible = columns.filter(
    (column) => filter === 'all' || (filter === 'on' ? isOn(column) : !isOn(column)),
  )
  const count = (id: Filter) =>
    id === 'all' ? columns.length : id === 'on' ? usedCount : columns.length - usedCount

  const close = () => {
    if (!busy) {
      onCancel()
    }
  }

  // Aplica un uso a una columna y avisa a los lectores de pantalla qué cambió
  const change = (column: DatasetColumnDto, use: Use) => {
    const { role, level } = parseUse(use)
    const next = assignRole(columns, column.name, role, level)
    const freed = next.filter(
      (item, index) => item.name !== column.name && item.role !== columns[index]?.role,
    )
    setColumns(next)
    setAnnouncement(
      `${displayName(column)}: ${fullUseName(use)}.${
        freed.length > 0 ? ` ${freed.map(displayName).join(', ')} pasó a No usar.` : ''
      }`,
    )
  }

  // Enciende o apaga una columna; al encenderla elige un uso según el tipo de sus valores
  const toggle = (column: DatasetColumnDto) => {
    const samples = preview.columns.find((item) => item.name === column.name)?.samples
    const role = turnOnRole(column.kind, { name: column.name, label: column.label, samples })
    change(column, isOn(column) ? 'ignore' : useOf({ role, level: null }))
    if (filter !== 'all') {
      filterRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus()
    }
  }

  // Cambia el significado de un valor codificado de una columna
  const mean = (name: string, code: string, label: string) =>
    setColumns((all) =>
      all.map((item) => (item.name === name ? withMeaning(item, code, label) : item)),
    )

  // Cambia el nombre en Vigia de una columna
  const rename = (name: string, label: string) =>
    setColumns((all) => all.map((item) => (item.name === name ? { ...item, label } : item)))

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
            Revisa cómo Vigia entendió tu archivo
          </h2>
          <p className="mt-1 text-sm text-muted">
            <strong className="text-text">{filename}</strong> · {formatNumber(preview.rows)} filas ·{' '}
            {preview.suggested_by === 'deepseek' ? 'La IA sugirió' : 'Sugerimos'} un nombre y un uso
            para cada columna. Cambia lo que no esté bien y revisa en el resumen cómo quedará tu
            tablero.
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

      <div className="map-split">
        <section className="map-left" aria-labelledby="map-cols-title">
          <div className="map-bar">
            <h3 id="map-cols-title">Columnas del archivo</h3>
            <div ref={filterRef} className="map-seg" role="group" aria-label="Filtrar columnas">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label} ({count(item.id)})
                </button>
              ))}
            </div>
            {idleNumbers > 0 && (
              <span className="map-tip">
                {idleNumbers}{' '}
                {idleNumbers === 1 ? 'columna numérica está' : 'columnas numéricas están'} sin usar.
              </span>
            )}
          </div>

          <div className="map-head" aria-hidden="true">
            <span>¿Usar?</span>
            <span>Nombre en Vigia · columna del archivo</span>
            <span>Ejemplos</span>
            <span>Uso en el tablero</span>
          </div>

          <div className="map-list" role="list" aria-label="Columnas del archivo">
            {visible.length === 0 && <p className="map-empty">No hay columnas en este filtro.</p>}
            {visible.map((column) => {
              const suggested = preview.columns.find((item) => item.name === column.name)
              const locked = personal.has(column.name)
              const on = isOn(column)
              const changed =
                suggested !== undefined &&
                (suggested.role !== column.role || suggested.level !== column.level)
              const name = displayName(column)
              const codes = meaningCodes(column, suggested?.codes)
              return (
                <div key={column.name} role="listitem" className="map-item">
                  <div className={`map-row${on ? '' : ' is-unused'}${locked ? ' is-locked' : ''}`}>
                    {locked ? (
                      <span className="map-lock">
                        <LockIcon /> Protegida
                      </span>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        className="map-switch"
                        aria-checked={on}
                        aria-label={`Usar ${name} en el tablero`}
                        onClick={() => toggle(column)}
                      >
                        <span className="map-track">
                          <span className="map-thumb" />
                        </span>
                        <span>{on ? 'Usar' : 'No usar'}</span>
                      </button>
                    )}

                    <div className="min-w-0">
                      <label className="map-label">
                        <input
                          className="map-label-input"
                          value={column.label}
                          maxLength={60}
                          placeholder={column.name}
                          aria-label={`Nombre en Vigia de la columna ${column.name}`}
                          onChange={(event) => rename(column.name, event.target.value)}
                        />
                        <PencilIcon />
                      </label>
                      <div className="map-sub" title={column.name}>
                        {locked ? (
                          <>
                            <LockIcon />
                            <code>{column.name}</code> · Dato personal: no se guarda ni se envía a
                            la IA.
                          </>
                        ) : changed ? (
                          <>
                            <code>{column.name}</code> · <em>Lo cambiaste tú.</em> Se sugería:{' '}
                            {fullUseName(useOf(suggested))}.
                          </>
                        ) : (
                          <>
                            <code>{column.name}</code>
                            {suggested?.reason ? ` · ${suggested.reason}` : ''}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="map-samples">
                      {locked ? (
                        <span className="map-sample is-hidden">Ocultos por privacidad</span>
                      ) : suggested && suggested.samples.length > 0 ? (
                        suggested.samples.map((sample) => (
                          <span key={sample} className="map-sample" title={sample}>
                            {sample}
                          </span>
                        ))
                      ) : (
                        '—'
                      )}
                    </div>

                    <div className={`map-use${on ? '' : ' is-off'}`}>
                      {locked ? (
                        <span className="map-chip">
                          <LockIcon /> No editable
                        </span>
                      ) : (
                        <Select
                          className="is-boxed"
                          label={`Uso en el tablero de ${name}`}
                          value={useOf(column)}
                          options={useOptions(columns, column.name)}
                          onChange={(use) => change(column, use)}
                        />
                      )}
                    </div>
                  </div>
                  {on && column.role === 'category' && codes.length > 0 && (
                    <ValueMeanings
                      column={column}
                      codes={codes}
                      onChange={(code, label) => mean(column.name, code, label)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <aside className="map-right" aria-labelledby="map-preview-title">
          <h3 id="map-preview-title">Así quedará tu tablero</h3>
          <p className="map-lead">
            Se actualiza con cada cambio. Algunos gráficos se omiten si los datos no alcanzan.
          </p>

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

          {!useful && (
            <ErrorBanner
              className="mb-3"
              message="Elige al menos una columna para usar: ahora todas están sin usar o protegidas. Activa una para continuar."
            />
          )}
          {useful && summary.warnings.length > 0 && (
            <div className="map-banner">
              <WarningIcon />
              <ul>
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <ul className="map-widgets">
            {summary.widgets.map((widget) => (
              <WidgetCard key={widget.id} widget={widget} />
            ))}
            {protectedCount > 0 && (
              <li className="map-widget is-neutral">
                <span className="map-widget-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <div className="min-w-0">
                  <h4>
                    {protectedCount}{' '}
                    {protectedCount === 1 ? 'columna protegida' : 'columnas protegidas'}
                    <span className="map-widget-state">
                      <CheckIcon /> Segura
                    </span>
                  </h4>
                  <p>
                    Son datos personales ({preview.pii_detected.join(', ')}): no se guardan ni se
                    envían a la IA.
                  </p>
                </div>
              </li>
            )}
          </ul>
          {idleNumbers > 0 && (
            <button type="button" className="map-link self-start" onClick={() => setFilter('off')}>
              Ver {idleNumbers} {idleNumbers === 1 ? 'columna numérica' : 'columnas numéricas'} sin
              usar
            </button>
          )}
        </aside>
      </div>

      <footer className="map-footer">
        <div className="map-summary">
          <strong>
            {usedCount} de {columns.length} columnas se usarán
          </strong>
          <span>
            {columns.length - usedCount - protectedCount} sin usar
            {protectedCount > 0 &&
              ` · ${protectedCount} ${protectedCount === 1 ? 'protegida' : 'protegidas'} (dato personal)`}
          </span>
          {!useful && (
            <span id="map-why" className="is-error">
              Elige al menos una columna para poder confirmar.
            </span>
          )}
        </div>
        <button type="button" className="btn" onClick={close} disabled={busy}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          aria-describedby={useful ? undefined : 'map-why'}
          onClick={() => onConfirm({ columns, title: title.trim(), topic: topic.trim() })}
          disabled={busy || !useful}
        >
          {busy ? 'Cargando…' : 'Confirmar y cargar'}
        </button>
      </footer>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </dialog>
  )
}
