'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import type { SessionUser, UploadDto } from '@vigia/contracts'

import { navItemForPath, type NavItem } from '../../constants/navigation'
import { formatNumber, plural } from '../../utils'
import { Logo, NavIcon } from '../ui'
import { UserCard } from './user-card'

// Enlaces a las páginas disponibles para el archivo elegido, marcando la actual
function NavLinks({ items }: { items: readonly NavItem[] }) {
  const current = navItemForPath(usePathname())

  return items.map((item) => {
    const active = item.id === current.id
    return (
      <Link
        key={item.id}
        href={item.href}
        className={`nav-btn no-underline${active ? ' active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <NavIcon name={item.id} />
        <span>{item.label}</span>
      </Link>
    )
  })
}

// Resume cuántos archivos y filas hay cargados
function uploadsSummary(uploads: ReadonlyArray<UploadDto>): string {
  if (uploads.length === 0) {
    return 'Sin datos'
  }
  const rows = uploads.reduce((sum, upload) => sum + upload.rows_in, 0)
  return `${uploads.length} ${plural(uploads.length, 'archivo')}, ${formatNumber(rows)} filas`
}

// Barra lateral con la marca, las páginas, los datos cargados y el usuario
export function Sidebar({
  uploads,
  items,
  user,
}: {
  uploads: ReadonlyArray<UploadDto>
  items: readonly NavItem[]
  user: SessionUser | null
}) {
  return (
    <aside className="rail" aria-label="Navegación">
      <div className="rail-brand">
        <Logo size={44} />
        <div>
          <span className="rail-brand-name">vigia</span>
          <span className="rail-brand-tag">análisis de datos de salud</span>
        </div>
      </div>
      <nav className="flex flex-col gap-1" aria-label="Módulos">
        <NavLinks items={items} />
      </nav>
      <div className="rail-foot">
        <div>
          <span className="rail-label">Datos cargados</span>
          <span className="rail-file">{uploadsSummary(uploads)}</span>
        </div>
        {user && <UserCard user={user} variant="rail" />}
      </div>
    </aside>
  )
}

// Navegación horizontal para pantallas angostas, con el usuario al final
export function MobileNav({
  items,
  user,
}: {
  items: readonly NavItem[]
  user: SessionUser | null
}) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    navRef.current
      ?.querySelector('.nav-btn.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])

  return (
    <nav ref={navRef} className="mobile-nav md:hidden" aria-label="Módulos">
      <NavLinks items={items} />
      {user && <UserCard user={user} variant="menu" />}
    </nav>
  )
}
