import Link from 'next/link'

// Aviso de que la página no aplica al archivo elegido, con salida al tablero
export function UnavailableState({ page }: { page: string }) {
  return (
    <section className="card flex flex-col items-start gap-3 py-8">
      <h2 className="text-lg font-bold text-text">{page} no aplica a este archivo</h2>
      <p className="max-w-[60ch] text-sm text-muted">
        Esta página necesita un archivo con fechas (o año y semana) y un lugar que llegue a
        departamento. Elige otro archivo arriba o mira lo que sí tiene este en el tablero.
      </p>
      <Link href="/" className="btn btn-primary no-underline">
        Ir al tablero
      </Link>
    </section>
  )
}
