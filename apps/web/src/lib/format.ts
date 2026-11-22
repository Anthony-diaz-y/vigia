// Formatea un número en español peruano o devuelve un guion si no es válido
export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—'
  }
  return Number(value).toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Clasifica la severidad de una anomalía según su puntaje z
export function severityOf(z: number): { label: string; className: string } {
  const value = Number(z)
  if (!Number.isFinite(value)) {
    return { label: '—', className: 'badge-warn' }
  }
  if (value >= 3) {
    return { label: 'Alta', className: 'badge-danger' }
  }
  if (value >= 2.5) {
    return { label: 'Media', className: 'badge-warn' }
  }
  return { label: 'Por debajo', className: 'badge-ok' }
}

// Califica el MASE del modelo: menor es mejor y bajo 1 supera la línea base estacional
export function maseQuality(mase: number | null): {
  label: string
  className: string
  width: number
} {
  const value = Number(mase)
  if (!Number.isFinite(value)) {
    return { label: '—', className: 'badge-warn', width: 0 }
  }
  if (value <= 0.75) {
    return { label: 'Muy bueno', className: 'badge-ok', width: 100 }
  }
  if (value < 1) {
    return { label: 'Bueno', className: 'badge-ok', width: 75 }
  }
  if (value < 1.5) {
    return { label: 'Limitado', className: 'badge-warn', width: 45 }
  }
  return { label: 'Débil', className: 'badge-danger', width: 22 }
}
