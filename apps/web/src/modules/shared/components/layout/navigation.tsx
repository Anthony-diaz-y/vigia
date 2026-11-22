'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import type { UploadDto } from '@vigia/contracts'

import { NAV_ITEMS, navItemForPath } from '../../constants/navigation'
import { formatNumber, plural } from '../../utils'
import { Logo, NavIcon } from '../ui'
import { ClearDataButton, TokenInput, type AccessControl } from './access-control'

// Enlaces a cada página, marcando la página actual
function NavLinks() {
  const current = navItemForPath(usePathname())

  return NAV_ITEMS.map((item) => {
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

// Barra lateral con la marca, las páginas y los ajustes de acceso
export function Sidebar({
  uploads,
  access,
}: {
  uploads: ReadonlyArray<UploadDto>
  access: AccessControl
}) {
  return (
    <aside className="rail" aria-label="Navegación">
      <div className="rail-brand">
        <Logo size={44} />
        <div>
          <span className="rail-brand-name">vigia</span>
          <span className="rail-brand-tag">vigilancia de dengue</span>
        </div>
      </div>
      <nav className="flex flex-col gap-1" aria-label="Módulos">
        <NavLinks />
      </nav>
      <div className="rail-foot">
        <div>
          <span className="rail-label">Datos cargados</span>
          <span className="rail-file">{uploadsSummary(uploads)}</span>
        </div>
        <TokenInput access={access} labelClassName="rail-label" inputClassName="rail-input" />
        <ClearDataButton access={access} className="rail-danger" />
      </div>
    </aside>
  )
}

// Navegación horizontal para pantallas angostas
export function MobileNav() {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    navRef.current
      ?.querySelector('.nav-btn.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])

  return (
    <nav ref={navRef} className="mobile-nav md:hidden" aria-label="Módulos">
      <NavLinks />
    </nav>
  )
}
