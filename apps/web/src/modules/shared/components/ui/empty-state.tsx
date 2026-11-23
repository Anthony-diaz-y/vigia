import { UploadIcon } from './icons'

// Estado vacío que invita a subir el primer archivo
export function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <section className="card flex flex-col items-start gap-3 py-10">
      <h2 className="text-xl font-bold text-text">Sube tu primer archivo</h2>
      <p className="max-w-[60ch] text-sm text-muted">
        Carga cualquier dataset de salud en CSV o XLSX: dengue, anemia, egresos u otro. Vigia
        reconoce sus columnas, te deja revisarlas y arma el tablero según lo que traiga.
      </p>
      <button type="button" className="btn btn-primary" onClick={onUpload}>
        <UploadIcon /> Subir archivo
      </button>
    </section>
  )
}
