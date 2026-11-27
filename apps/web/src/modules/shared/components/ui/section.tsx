import type { ReactNode } from 'react'

// Tarjeta con título (h2 por defecto, h3 si va dentro de otra sección) y subtítulo opcional
export function Section({
  title,
  subtitle,
  level = 2,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  level?: 2 | 3
  children: ReactNode
  className?: string
}) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <section className={`card ${className}`}>
      <Heading className="section-title">{title}</Heading>
      {subtitle && <p className="card-sub">{subtitle}</p>}
      {children}
    </section>
  )
}
