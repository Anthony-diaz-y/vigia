// Tarjeta de carga mientras se resuelve una consulta
export function LoadingState({ label = 'Cargando datos…' }: { label?: string }) {
  return (
    <section className="card" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted">{label}</p>
    </section>
  )
}
