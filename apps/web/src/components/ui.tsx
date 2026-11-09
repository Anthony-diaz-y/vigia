'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'

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

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'danger'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

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

export function EmptyState() {
  return (
    <Section title="Sin datos aún">
      <p className="text-sm text-muted">
        Subí un archivo de vigilancia (CSV/XLSX) para ver el panel de análisis y el pronóstico.
      </p>
    </Section>
  )
}

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
  publish: 'Publicado',
  insufficient_evidence: 'Evidencia insuficiente',
}
