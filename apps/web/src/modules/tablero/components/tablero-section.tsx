import type { ReactNode } from 'react'

// Bloque del tablero con título h2, descripción corta y cuadrícula de tarjetas
export function TableroSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  const headingId = `tablero-${id}`
  return (
    <section aria-labelledby={headingId} className="tb-section">
      <header className="tb-section-head">
        <h2 id={headingId} className="tb-section-title">
          {title}
        </h2>
        <p className="tb-section-desc">{description}</p>
      </header>
      {children}
    </section>
  )
}
