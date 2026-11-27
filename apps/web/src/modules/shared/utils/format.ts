export type Tone = 'ok' | 'warn' | 'danger'

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

// Elige la forma singular o plural de una palabra según la cantidad
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm
}

// Clasifica la severidad de una anomalía según su puntaje z
export function severityOf(z: number): { label: string; tone: Tone } {
  const value = Number(z)
  if (!Number.isFinite(value)) {
    return { label: '—', tone: 'warn' }
  }
  if (value >= 3) {
    return { label: 'Alta', tone: 'danger' }
  }
  if (value >= 2.5) {
    return { label: 'Media', tone: 'warn' }
  }
  return { label: 'Por debajo', tone: 'ok' }
}

// Califica el MASE del modelo: menor es mejor y bajo 1 supera la línea base estacional
export function maseQuality(mase: number | null): { label: string; tone: Tone; width: number } {
  const value = Number(mase)
  if (!Number.isFinite(value)) {
    return { label: '—', tone: 'warn', width: 0 }
  }
  if (value <= 0.75) {
    return { label: 'Muy bueno', tone: 'ok', width: 100 }
  }
  if (value < 1) {
    return { label: 'Bueno', tone: 'ok', width: 75 }
  }
  if (value < 1.5) {
    return { label: 'Limitado', tone: 'warn', width: 45 }
  }
  return { label: 'Débil', tone: 'danger', width: 22 }
}

// Extrae un mensaje legible de un error desconocido
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AxiosError') {
    return 'No se pudo conectar con el servidor de Vigia. Revisa tu conexión e inténtalo de nuevo.'
  }
  return error instanceof Error ? error.message : String(error)
}

// Abrevia números grandes en miles, igual en servidor y navegador
export function compactNumber(value: number): string {
  if (value < 1000) {
    return formatNumber(value)
  }
  return `${formatNumber(value / 1000, value >= 10_000 ? 0 : 1)} mil`
}
