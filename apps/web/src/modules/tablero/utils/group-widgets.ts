import type { WidgetDto } from '@vigia/contracts'

export type SectionId = 'evolucion' | 'donde' | 'distribucion' | 'categoria'

export interface WidgetSection {
  id: SectionId
  title: string
  description: string
  widgets: WidgetDto[]
}

const SECTIONS: ReadonlyArray<Omit<WidgetSection, 'widgets'>> = [
  {
    id: 'evolucion',
    title: 'Evolución',
    description: 'Cómo cambia el indicador a lo largo del tiempo.',
  },
  {
    id: 'donde',
    title: 'Dónde',
    description: 'En qué lugares se concentra el indicador.',
  },
  {
    id: 'distribucion',
    title: 'Distribución de indicadores',
    description: 'Cómo se reparten los valores de cada medida del archivo.',
  },
  {
    id: 'categoria',
    title: 'Por categoría',
    description: 'El indicador separado según las categorías del archivo.',
  },
]

const PLACE_TITLE = /\spor (departamento|provincia|distrito|ubicación)$/
const WIDE: ReadonlySet<WidgetDto['type']> = new Set(['timeseries', 'interannual', 'heatmap'])

// Sección donde va un widget; los KPIs se dibujan aparte y no pertenecen a ninguna
function sectionOf(widget: WidgetDto): SectionId | null {
  switch (widget.type) {
    case 'kpis':
      return null
    case 'timeseries':
    case 'interannual':
      return 'evolucion'
    case 'ranking':
    case 'heatmap':
      return 'donde'
    case 'histogram':
      return 'distribucion'
    case 'breakdown':
      return PLACE_TITLE.test(widget.title) ? 'donde' : 'categoria'
  }
}

// Indica si un widget es una tarjeta compacta (proporción o dominante) y no una lista de barras
export function isCompact(widget: WidgetDto): boolean {
  return (
    widget.type === 'breakdown' &&
    (widget.variant === 'proportion' || widget.variant === 'dominant')
  )
}

// Reparte los widgets en secciones ordenadas (los anchos al final) y descarta las vacías
export function groupWidgets(widgets: ReadonlyArray<WidgetDto>): WidgetSection[] {
  return SECTIONS.map((section) => ({
    ...section,
    widgets: widgets
      .filter((widget) => sectionOf(widget) === section.id)
      .sort((left, right) => Number(WIDE.has(left.type)) - Number(WIDE.has(right.type))),
  })).filter((section) => section.widgets.length > 0)
}

// Indica qué widgets ocupan todo el ancho: los anchos y el que quedaría solo en su fila
export function fullWidthFlags(widgets: ReadonlyArray<WidgetDto>): boolean[] {
  const flags: boolean[] = []
  let column = 0
  widgets.forEach((widget, index) => {
    const next = widgets[index + 1]
    const alone = column === 0 && (next === undefined || WIDE.has(next.type))
    if (WIDE.has(widget.type) || alone) {
      flags.push(true)
      column = 0
      return
    }
    flags.push(false)
    column = column === 0 ? 1 : 0
  })
  return flags
}
