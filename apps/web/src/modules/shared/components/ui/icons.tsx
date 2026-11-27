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
  tablero: (
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
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  archivos: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M9 14h6M9 17h4" />
    </>
  ),
}

// Ícono de navegación según el nombre de la página
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

// Ícono de gráfico de barras para el indicador
export function ChartIcon() {
  return (
    <svg {...ICON} width={16} height={16}>
      <path d="M4 20V11M10 20V5M16 20v-6M3 20h18" />
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
    <svg {...ICON} strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

// Ícono de luna para el tema oscuro
export function MoonIcon() {
  return (
    <svg {...ICON} strokeWidth={2}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

// Ícono de cerrar (X) para diálogos
export function CloseIcon() {
  return (
    <svg {...ICON} strokeWidth={2}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

// Ícono de lápiz para indicar que un texto se puede editar
export function PencilIcon() {
  return (
    <svg {...ICON} width={14} height={14}>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

// Ícono de candado para datos protegidos
export function LockIcon() {
  return (
    <svg {...ICON} width={16} height={16}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

// Ícono de salida para cerrar sesión
export function LogoutIcon() {
  return (
    <svg {...ICON}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </svg>
  )
}
