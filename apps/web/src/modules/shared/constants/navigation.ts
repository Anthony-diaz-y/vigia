// Cada entrada es una página real del sistema y su vínculo en la navegación
export const NAV_ITEMS = [
  {
    id: 'resumen',
    href: '/',
    label: 'Resumen',
    description: 'Cómo viene la semana, de un vistazo.',
    usesYear: true,
  },
  {
    id: 'recomendaciones',
    href: '/recomendaciones',
    label: 'Recomendaciones',
    description: 'Dónde actuar primero y qué esperar en los próximos años.',
    usesYear: false,
  },
  {
    id: 'analisis',
    href: '/analisis',
    label: 'Análisis',
    description: 'Dónde y cuándo se concentran los casos.',
    usesYear: true,
  },
  {
    id: 'pronostico',
    href: '/pronostico',
    label: 'Pronóstico',
    description: 'Casos esperados en las próximas semanas, solo donde el modelo es confiable.',
    usesYear: false,
  },
  {
    id: 'explicacion',
    href: '/explicacion',
    label: 'Explicación',
    description: 'Qué factores mueven el pronóstico en cada departamento.',
    usesYear: false,
  },
  {
    id: 'archivos',
    href: '/archivos',
    label: 'Archivos',
    description: 'Archivos cargados y la calidad de sus datos.',
    usesYear: false,
  },
] as const

type NavItem = (typeof NAV_ITEMS)[number]

// Devuelve la entrada de navegación que corresponde a la ruta actual
export function navItemForPath(pathname: string): NavItem {
  return (
    NAV_ITEMS.find((item) =>
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
    ) ?? NAV_ITEMS[0]
  )
}
