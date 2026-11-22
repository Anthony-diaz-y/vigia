import type { CSSProperties } from 'react'

export const ACCENT = 'var(--accent)'

const PAST_YEARS = ['var(--series-muted-1)', 'var(--series-muted-2)', 'var(--series-muted-3)']

// Color de cada año: acento para el más reciente y grises para los anteriores
export function yearColor(index: number, total: number): string {
  if (index === total - 1) {
    return ACCENT
  }
  return PAST_YEARS[Math.min(total - 2 - index, PAST_YEARS.length - 1)] ?? PAST_YEARS[0]!
}

export const TOOLTIP_STYLE: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
  boxShadow: 'var(--shadow-md)',
}

export const AXIS_TICK = { fontSize: 11, fill: 'var(--muted)' }
export const AXIS_LABEL = { fontSize: 12, fill: 'var(--muted)' }
