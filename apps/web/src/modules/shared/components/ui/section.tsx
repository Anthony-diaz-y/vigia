import type { ReactNode } from 'react'

// Tarjeta con título de sección que envuelve su contenido
export function Section({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className}`}>
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  )
}
