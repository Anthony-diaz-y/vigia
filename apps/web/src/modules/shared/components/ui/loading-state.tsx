// Esqueleto de carga con la forma de un tablero y el mensaje de lo que se está preparando
export function LoadingState({ label = 'Cargando datos…' }: { label?: string }) {
  return (
    <section className="card skeleton-card" aria-busy="true" aria-live="polite">
      <p className="skeleton-label">{label}</p>
      <div className="skeleton-row" aria-hidden="true">
        <span className="skeleton skeleton-kpi" />
        <span className="skeleton skeleton-kpi" />
        <span className="skeleton skeleton-kpi" />
      </div>
      <span className="skeleton skeleton-chart" aria-hidden="true" />
    </section>
  )
}
