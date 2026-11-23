import type { OutlookDto } from '@vigia/contracts'

import { Section } from '../ui'
import { formatNumber, plural } from '../../utils'

import { CONFIDENCE_LABEL } from './confidence'
import { OutlookTable } from './outlook-table'
import { YearBars } from './year-bars'

// Sección con la proyección de casos para los próximos años y su confianza
export function OutlookSection({
  outlook,
  unit = 'casos',
}: {
  outlook: OutlookDto
  unit?: string
}) {
  const { total } = outlook
  if (total.projection.length === 0) {
    return (
      <Section title={`Próximos ${outlook.horizon_years} años`}>
        <p className="text-sm text-muted">
          Se necesita al menos un año completo de datos para proyectar los próximos años.
        </p>
      </Section>
    )
  }

  const first = total.projection[0]
  const last = total.projection.at(-1)
  const { complete_years: complete, estimated_years: estimated } = outlook
  const history = [
    `${complete} ${plural(complete, 'año')} ${plural(complete, 'completo')}`,
    estimated > 0 ? `${estimated} ${plural(estimated, 'estimado')}` : null,
  ]
    .filter(Boolean)
    .join(' y ')

  return (
    <section className="card">
      <div className="outlook-head">
        <h2 className="section-title">Próximos {outlook.horizon_years} años</h2>
        <span className={`confidence confidence-${outlook.confidence}`}>
          {CONFIDENCE_LABEL[outlook.confidence]}
        </span>
      </div>
      {first && last && (
        <p className="outlook-lead">
          Se esperan unos <strong>{formatNumber(first.p50)}</strong> {unit} en {first.year} y{' '}
          <strong>{formatNumber(last.p50)}</strong> en {last.year}.
        </p>
      )}

      <YearBars outlook={outlook} unit={unit} />

      <ul className="outlook-legend" aria-hidden="true">
        <li>
          <span className="swatch swatch-observed" /> Observado
        </li>
        <li>
          <span className="swatch swatch-estimated" /> Año incompleto, estimado
        </li>
        <li>
          <span className="swatch swatch-projected" /> Proyección
        </li>
        <li>
          <span className="swatch swatch-range" /> Rango probable (80 %)
        </li>
      </ul>

      {outlook.departments.length > 1 && <OutlookTable outlook={outlook} />}

      <p className="card-note">
        Basado en {history}. Sirve para planificar presupuesto, personal e insumos, no como cifra
        exacta: un año de brote puede superar el rango.
      </p>
    </section>
  )
}
