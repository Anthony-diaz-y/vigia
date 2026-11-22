'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'

// Muestra el logo circular de vigia con el tamaño indicado
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <Image
      src="/logo.webp"
      alt="vigia"
      width={size}
      height={size}
      priority
      className="rounded-full"
    />
  )
}

// Tarjeta con título de sección que envuelve su contenido
export function Section({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className}`}>
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  )
}

// Indicador con etiqueta, valor y variación opcional
export function Kpi({
  label,
  value,
  delta,
  small = false,
  warn = false,
}: {
  label: string
  value: ReactNode
  delta?: ReactNode
  small?: boolean
  warn?: boolean
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${small ? ' kpi-value-small' : ''}`}>{value}</div>
      {delta !== undefined && (
        <div className={`kpi-delta${warn ? ' kpi-delta-warn' : ''}`}>{delta}</div>
      )}
    </div>
  )
}

// Etiqueta de estado con tono ok, advertencia o peligro
export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'danger'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

// Aviso de error accesible con el mensaje recibido
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-sm)] border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger"
    >
      {message}
    </div>
  )
}

// Estado vacío que invita a subir el primer archivo
export function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <section className="card flex flex-col items-start gap-3 py-10">
      <h2 className="text-xl font-bold text-text">Subí tu primer archivo</h2>
      <p className="max-w-[60ch] text-sm text-muted">
        Cargá un export de vigilancia (CSV o XLSX) con casos por departamento y semana
        epidemiológica. Vas a revisar el mapeo de columnas antes de guardarlo.
      </p>
      <button type="button" className="btn btn-primary" onClick={onUpload}>
        <UploadIcon /> Subir archivo
      </button>
    </section>
  )
}

const ICON = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const NAV_PATHS: Record<string, ReactNode> = {
  resumen: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  recomendaciones: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  analisis: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </>
  ),
  pronostico: (
    <>
      <path d="M3 17l5-5 4 3 4-6" />
      <path d="M16 9l5-3" strokeDasharray="2 2.5" />
      <path d="M3 21h18" />
    </>
  ),
  explicacion: (
    <>
      <path d="M4 6h10M4 12h16M4 18h7" />
    </>
  ),
  ingesta: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M9 14h6M9 17h4" />
    </>
  ),
}

// Ícono de navegación según el nombre de la vista
export function NavIcon({ name }: { name: string }) {
  return <svg {...ICON}>{NAV_PATHS[name]}</svg>
}

// Ícono de subir archivo
export function UploadIcon() {
  return (
    <svg {...ICON} width={16} height={16}>
      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
    </svg>
  )
}

// Ícono de documento
export function FileIcon() {
  return (
    <svg {...ICON} width={16} height={16}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </svg>
  )
}

// Ícono de calendario
export function CalendarIcon() {
  return (
    <svg {...ICON} width={16} height={16}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

// Ícono de recargar que puede girar mientras se actualiza
export function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg {...ICON} className={spinning ? 'animate-spin' : undefined}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
    </svg>
  )
}

// Ícono de sol para el tema claro
export function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

// Ícono de luna para el tema oscuro
export function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

export const UPLOAD_STATUS_LABELS: Record<string, string> = {
  ok: 'OK',
  ok_with_issues: 'OK con observaciones',
}

export const FORECAST_STATUS_LABELS: Record<string, string> = {
  publish: 'Confiable',
  insufficient_evidence: 'No confiable aún',
}
