import type { UploadDto } from '@vigia/contracts'

export type NavRequirement = 'any' | 'weekly'

export interface NavItem {
  id: string
  href: string
  label: string
  description: string
  usesYear: boolean
  usesIndicator: boolean
  requires: NavRequirement
}

// Cada entrada es una página real del sistema y lo que el dataset necesita para mostrarla
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'tablero',
    href: '/',
    label: 'Tablero',
    description: 'Lo principal del archivo, en gráficos que se adaptan a sus datos.',
    usesYear: true,
    usesIndicator: true,
    requires: 'any',
  },
  {
    id: 'recomendaciones',
    href: '/recomendaciones',
    label: 'Recomendaciones',
    description: 'Dónde actuar primero y qué esperar en los próximos años.',
    usesYear: false,
    usesIndicator: true,
    requires: 'weekly',
  },
  {
    id: 'analisis',
    href: '/analisis',
    label: 'Análisis',
    description: 'Dónde y cuándo se concentran los valores, y qué semanas salen de lo esperado.',
    usesYear: true,
    usesIndicator: true,
    requires: 'weekly',
  },
  {
    id: 'pronostico',
    href: '/pronostico',
    label: 'Pronóstico',
    description: 'Qué se espera en los próximos periodos, solo cuando el modelo es confiable.',
    usesYear: false,
    usesIndicator: true,
    requires: 'any',
  },
  {
    id: 'explicacion',
    href: '/explicacion',
    label: 'Explicación',
    description: 'Qué factores mueven el pronóstico en cada lugar.',
    usesYear: false,
    usesIndicator: true,
    requires: 'weekly',
  },
  {
    id: 'archivos',
    href: '/archivos',
    label: 'Archivos',
    description: 'Archivos cargados y la calidad de sus datos.',
    usesYear: false,
    usesIndicator: false,
    requires: 'any',
  },
]

// Devuelve la entrada de navegación que corresponde a la ruta actual
export function navItemForPath(pathname: string): NavItem {
  return (
    NAV_ITEMS.find((item) =>
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
    ) ?? NAV_ITEMS[0]!
  )
}

// Indica si el archivo elegido tiene lo necesario para mostrar una página (fechas o semanas)
export function isAvailable(item: NavItem, upload: UploadDto | null): boolean {
  return item.requires === 'any' || upload?.time === 'date' || upload?.time === 'week'
}
