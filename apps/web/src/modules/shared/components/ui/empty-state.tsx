import { UploadIcon } from './icons'

// Estado vacío que invita a subir el primer archivo
export function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <section className="card flex flex-col items-start gap-3 py-10">
      <h2 className="text-xl font-bold text-text">Subí tu primer archivo</h2>
      <p className="max-w-[60ch] text-sm text-muted">
        Cargá un export de vigilancia (CSV o XLSX) con casos por departamento y semana
        epidemiológica. Vas a revisar el mapeo de columnas antes de guardarlo.
      </p>
      <button type="button" className="btn btn-primary" onClick={onUpload}>
        <UploadIcon /> Subir archivo
      </button>
    </section>
  )
}
