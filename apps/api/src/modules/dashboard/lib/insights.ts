import type { InsightDto, WidgetDto } from '@vigia/contracts'
import type { Indicator } from '@vigia/epidemiology'

const MAX_INSIGHTS = 5
const TREND_THRESHOLD = 0.2
const SAME_THRESHOLD = 0.05
const CONCENTRATION_SHARE = 0.4
const DOMINANT_SHARE = 0.5
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

type Widget<T extends WidgetDto['type']> = Extract<WidgetDto, { type: T }>

interface Wording {
  subject: string
  share: string
  mean: boolean
}

// Frases con concordancia según el indicador: "El número de registros", "del total de casos"
export function wordingFor(indicator: Indicator, label: string): Wording {
  const lower = label.charAt(0).toLowerCase() + label.slice(1)
  if (indicator.kind === 'records') {
    return { subject: 'El número de registros', share: 'de los registros', mean: false }
  }
  if (indicator.kind === 'sum') {
    return { subject: `El ${lower}`, share: `del ${lower}`, mean: false }
  }
  return { subject: label, share: `de ${lower}`, mean: true }
}

// Busca el primer widget de un tipo
function widgetOf<T extends WidgetDto['type']>(widgets: WidgetDto[], type: T): Widget<T> | null {
  return (widgets.find((widget) => widget.type === type) as Widget<T> | undefined) ?? null
}

// Formatea un número en español con hasta un decimal
function number(value: number): string {
  return value.toLocaleString('es-PE', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 })
}

// Porcentaje redondeado sin decimales
function percent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`
}

// Veces que un valor contiene a otro, redondeado a un decimal (2,5 veces)
function times(now: number, before: number): string {
  return number(Math.round((now / before) * 10) / 10)
}

// Suma o promedio de una lista, según el indicador
function combine(values: number[], mean: boolean): number {
  const total = values.reduce((sum, value) => sum + value, 0)
  return mean ? total / Math.max(values.length, 1) : total
}

// Convierte la clave de un periodo (2027-S05, 2027-03, 2027-03-14, 2027) en texto legible
export function periodText(period: string): string {
  const week = /^(\d{4})-S(\d{2})$/.exec(period)
  if (week) {
    return `la semana ${Number(week[2])} de ${week[1]}`
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period)
  if (day) {
    return `el ${Number(day[3])} de ${MONTHS[Number(day[2]) - 1]} de ${day[1]}`
  }
  const month = /^(\d{4})-(\d{2})$/.exec(period)
  if (month) {
    return `${MONTHS[Number(month[2]) - 1]} de ${month[1]}`
  }
  return period
}

// Nombre de la unidad de tiempo en plural para frases como "las últimas 4 semanas"
function unitName(period: string): string {
  if (/-S\d{2}$/.test(period)) {
    return 'semanas'
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return 'días'
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    return 'meses'
  }
  return 'años'
}

// Tendencia: compara los últimos periodos con los anteriores del mismo largo
function trend(widgets: WidgetDto[], { subject, mean }: Wording): InsightDto | null {
  const series = widgetOf(widgets, 'timeseries')?.points ?? []
  const values = series.map((point) => point.value ?? 0)
  const window = Math.min(4, Math.floor(values.length / 2))
  const last = series.at(-1)
  if (window < 2 || !last) {
    return null
  }
  const recent = combine(values.slice(-window), mean)
  const before = combine(values.slice(-2 * window, -window), mean)
  const span = `las últimas ${window} ${unitName(last.period)} frente a las ${window} anteriores`
  if (before === 0 && recent === 0) {
    return null
  }
  if (before === 0) {
    return {
      kind: 'trend',
      tone: 'up',
      text: `${subject} vuelve a aparecer en ${span}, después de estar en cero.`,
    }
  }
  const change = (recent - before) / before
  if (Math.abs(change) < TREND_THRESHOLD) {
    return { kind: 'trend', tone: 'neutral', text: `${subject} se mantiene estable en ${span}.` }
  }
  const amount =
    change >= 2
      ? `se multiplica por ${times(recent, before)}`
      : `${change > 0 ? 'sube' : 'baja'} ${percent(Math.abs(change))}`
  return {
    kind: 'trend',
    tone: change > 0 ? 'up' : 'down',
    text: `${subject} ${amount} en ${span}.`,
  }
}

// Pico: el periodo con el valor más alto de la serie
function peak(widgets: WidgetDto[]): InsightDto | null {
  const series = (widgetOf(widgets, 'timeseries')?.points ?? []).filter(
    (point): point is { period: string; value: number } => point.value !== null,
  )
  if (series.length < 3) {
    return null
  }
  const top = series.reduce((best, point) => (point.value > best.value ? point : best))
  if (top.value <= 0) {
    return null
  }
  return {
    kind: 'peak',
    tone: 'neutral',
    text: `El valor más alto fue en ${periodText(top.period)}, con ${number(top.value)}.`,
  }
}

// Comparación con el año anterior en los mismos periodos que ya tienen datos este año
function yearOverYear(widgets: WidgetDto[], { mean }: Wording): InsightDto | null {
  const widget = widgetOf(widgets, 'interannual')
  const [previous, current] = widget?.years.slice(-2) ?? []
  if (!widget || !previous || !current) {
    return null
  }
  const shared = widget.rows.filter((row) => row[current] !== null && row[current] !== undefined)
  const now = combine(
    shared.map((row) => row[current] ?? 0),
    mean,
  )
  const before = combine(
    shared.map((row) => row[previous] ?? 0),
    mean,
  )
  if (shared.length < 2 || before === 0) {
    return null
  }
  const change = (now - before) / before
  const same = Math.abs(change) < SAME_THRESHOLD
  const direction = same
    ? `casi igual que en el mismo periodo de ${previous}`
    : change >= 2
      ? `${times(now, before)} veces lo del mismo periodo de ${previous}`
      : `${percent(Math.abs(change))} ${change > 0 ? 'más' : 'menos'} que en el mismo periodo de ${previous}`
  const verb = mean ? `el promedio es ${number(now)},` : `van ${number(now)},`
  return {
    kind: 'comparison',
    tone: same ? 'neutral' : change > 0 ? 'up' : 'down',
    text: `En ${current} ${verb} ${direction}.`,
  }
}

// Concentración: cuánto pesa el lugar con más valor sobre el total
function concentration(widgets: WidgetDto[], { share: of }: Wording): InsightDto | null {
  const rows = widgetOf(widgets, 'ranking')?.rows ?? []
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const top = rows[0]
  if (rows.length < 2 || !top || total <= 0) {
    return null
  }
  const share = top.value / total
  const text =
    share >= CONCENTRATION_SHARE
      ? `${top.name} concentra el ${percent(share)} ${of}.`
      : `El valor se reparte entre ${rows.length} lugares; el primero, ${top.name}, tiene el ${percent(share)}.`
  return { kind: 'concentration', tone: 'neutral', text }
}

// Categorías dominantes: valores que reúnen más de la mitad en cada desglose en barras (las tarjetas ya lo dicen)
function dominant(widgets: WidgetDto[]): InsightDto[] {
  return widgets
    .filter(
      (widget): widget is Widget<'breakdown'> =>
        widget.type === 'breakdown' && (widget.variant ?? 'bars') === 'bars',
    )
    .flatMap((widget) => {
      const total = widget.rows.reduce((sum, row) => sum + row.value, 0)
      const top = widget.rows[0]
      if (!top || total <= 0 || widget.rows.length < 2 || top.value / total < DOMINANT_SHARE) {
        return []
      }
      const dimension = widget.title.split(' por ').at(-1) ?? widget.title
      return [
        {
          kind: 'dominant' as const,
          tone: 'neutral' as const,
          text: `En ${dimension}, predomina ${top.label ?? top.name} con el ${percent(top.value / total)}.`,
        },
      ]
    })
}

// Hallazgos en lenguaje simple calculados solo con los datos del tablero, sin inventar cifras
export function findInsights(
  widgets: WidgetDto[],
  indicator: Indicator,
  label: string,
): InsightDto[] {
  const wording = wordingFor(indicator, label)
  const found = [
    trend(widgets, wording),
    yearOverYear(widgets, wording),
    peak(widgets),
    wording.mean ? null : concentration(widgets, wording),
    ...(wording.mean ? [] : dominant(widgets)),
  ]
  return found.filter((insight): insight is InsightDto => insight !== null).slice(0, MAX_INSIGHTS)
}
