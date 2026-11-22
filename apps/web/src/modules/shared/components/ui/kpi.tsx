import type { ReactNode } from 'react'

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
