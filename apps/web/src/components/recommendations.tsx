'use client'

import { useState } from 'react'

import type {
  AlertLevelDto,
  OutlookDto,
  RecommendationItemDto,
  RecommendationsResponse,
} from '@vigia/contracts'

import { formatNumber } from '@/lib/format'

const LEVEL_LABEL: Record<AlertLevelDto, string> = {
  alto: 'Alerta alta',
  medio: 'Atención',
  bajo: 'Estable',
}

const CONFIDENCE_LABEL: Record<OutlookDto['confidence'], string> = {
  baja: 'Confianza baja',
  media: 'Confianza media',
  alta: 'Confianza alta',
}

const MIN_CASES_FOR_ROW = 10
const OUTLOOK_TABLE_ROWS = 5

// Texto con el rango de semanas analizado o null si no hay ventana
function windowLabel(data: RecommendationsResponse): string | null {
  if (!data.window) {
    return null
  }
  const { from, to } = data.window
  return from.year === to.year
    ? `semanas ${from.epi_week} a ${to.epi_week} de ${to.year}`
    : `semana ${from.epi_week} de ${from.year} a ${to.epi_week} de ${to.year}`
}

// Muestra la variación porcentual con flecha y color según suba o baje
function Trend({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="trend">—</span>
  }
  const tone = value >= 10 ? 'trend-up' : value <= -10 ? 'trend-down' : ''
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : ''
  return (
    <span className={`trend ${tone}`}>
      {arrow} {Math.abs(value)} %
    </span>
  )
}

// Banner compacto del nivel de alerta para la vista de resumen
export function RecommendationBanner({
  data,
  onOpen,
}: {
  data: RecommendationsResponse
  onOpen: () => void
}) {
  return (
    <section className={`brief-banner level-${data.overall_level}`}>
      <span className="level-dot" aria-hidden="true" />
      <p className="brief-banner-text">
        <strong>{LEVEL_LABEL[data.overall_level]}.</strong> {data.summary.headline}
      </p>
      <button type="button" className="btn btn-primary" onClick={onOpen}>
        Ver recomendaciones
      </button>
    </section>
  )
}

// Vista de recomendaciones: resumen, dónde actuar y proyección de los próximos años
export function RecommendationsView({
  data,
  loading,
}: {
  data: RecommendationsResponse | null
  loading: boolean
}) {
  if (!data) {
    return (
      <section className="card">
        <p className="text-sm text-muted">
          {loading
            ? 'Preparando las recomendaciones…'
            : 'No hay recomendaciones: subí un archivo de vigilancia para generarlas.'}
        </p>
      </section>
    )
  }

  const period = windowLabel(data)

  return (
    <>
      <section className={`brief level-${data.overall_level}`} aria-live="polite">
        <p className="brief-meta">
          <span className="level-dot" aria-hidden="true" />
          <span>
            {LEVEL_LABEL[data.overall_level]}
            {period && <span className="text-muted">, {period}</span>}
          </span>
        </p>
        <h2 className="brief-title">{data.summary.headline}</h2>
        <p className="brief-text">{data.summary.text}</p>
        <p className="brief-source">
          {data.summary.source === 'deepseek'
            ? 'Resumen redactado por IA (DeepSeek) a partir de los datos.'
            : 'Resumen automático a partir de los datos.'}
          {loading && ' Actualizando…'}
        </p>
      </section>

      <ActionList items={data.items} />
      <OutlookSection outlook={data.outlook} />

      <p className="brief-footnote">
        Los niveles y las acciones salen de reglas fijas. La IA solo redacta el resumen.
      </p>
    </>
  )
}

// Lista desplegable de departamentos con su nivel, casos y acciones sugeridas
function ActionList({ items }: { items: RecommendationItemDto[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const [showQuiet, setShowQuiet] = useState(false)

  const relevant = items.filter(
    (item) => item.level !== 'bajo' || item.recent_cases >= MIN_CASES_FOR_ROW,
  )
  const quiet = items.filter((item) => !relevant.includes(item))

  return (
    <section className="card">
      <h2 className="section-title">Dónde actuar</h2>
      <ul className="act-list">
        {relevant.map((item) => {
          const expanded = open === item.department
          return (
            <li key={item.department} className={`act-row level-${item.level}`}>
              <button
                type="button"
                className="act-summary"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : item.department)}
              >
                <span className="act-name">
                  <span className="level-dot" aria-hidden="true" />
                  {item.department}
                </span>
                <span className="act-level">{LEVEL_LABEL[item.level]}</span>
                <span className="act-cases">
                  {formatNumber(item.recent_cases, 0)} casos <Trend value={item.change_pct} />
                </span>
                <span className="act-action">{item.actions[0]}</span>
                <span className="act-chevron" aria-hidden="true" />
              </button>
              {expanded && (
                <div className="act-detail">
                  <ul className="act-reasons">
                    {item.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  {item.actions.length > 1 && (
                    <p className="act-next">
                      También: <span>{item.actions.slice(1).join(' ')}</span>
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {quiet.length > 0 && (
        <div className="act-quiet">
          <button
            type="button"
            className="link-btn"
            aria-expanded={showQuiet}
            onClick={() => setShowQuiet((value) => !value)}
          >
            {showQuiet ? 'Ocultar' : 'Ver'} {quiet.length} departamento
            {quiet.length === 1 ? '' : 's'} sin casos relevantes
          </button>
          {showQuiet && (
            <p className="act-quiet-list">{quiet.map((item) => item.department).join(', ')}</p>
          )}
        </div>
      )}
    </section>
  )
}

// Sección con la proyección de casos para los próximos años y su confianza
function OutlookSection({ outlook }: { outlook: OutlookDto }) {
  const { total } = outlook
  if (total.projection.length === 0) {
    return (
      <section className="card">
        <h2 className="section-title">Próximos {outlook.horizon_years} años</h2>
        <p className="text-sm text-muted">
          Se necesita al menos un año completo de datos para proyectar los próximos años.
        </p>
      </section>
    )
  }

  const first = total.projection[0]
  const last = total.projection.at(-1)
  const history = [
    `${outlook.complete_years} año${outlook.complete_years === 1 ? '' : 's'} completo${
      outlook.complete_years === 1 ? '' : 's'
    }`,
    outlook.estimated_years > 0
      ? `${outlook.estimated_years} estimado${outlook.estimated_years === 1 ? '' : 's'}`
      : null,
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
          Se esperan unos <strong>{formatNumber(first.p50, 0)}</strong> casos en {first.year} y{' '}
          <strong>{formatNumber(last.p50, 0)}</strong> en {last.year}.
        </p>
      )}

      <YearBars outlook={outlook} />

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

// Barras anuales de casos observados, estimados y proyectados con su rango
function YearBars({ outlook }: { outlook: OutlookDto }) {
  const { projection } = outlook.total
  const observed = outlook.total.history
  const history: Array<{ year: number; cases: number | null; estimated: boolean }> = []
  for (const point of observed) {
    const previous = history.at(-1)
    for (let year = (previous?.year ?? point.year) + 1; year < point.year; year += 1) {
      history.push({ year, cases: null, estimated: false })
    }
    history.push(point)
  }
  const peak = Math.max(
    1,
    ...observed.map((point) => point.cases),
    ...projection.map((point) => point.p90),
  )
  // Convierte un valor en porcentaje de altura respecto al pico
  const pct = (value: number) => `${(value / peak) * 100}%`
  const label = [
    ...history.map((point) =>
      point.cases === null
        ? `${point.year}: sin datos`
        : `${point.year}: ${formatNumber(point.cases, 0)} casos${point.estimated ? ' (estimado)' : ''}`,
    ),
    ...projection.map(
      (point) =>
        `${point.year}: ${formatNumber(point.p50, 0)} casos proyectados (entre ${formatNumber(
          point.p10,
          0,
        )} y ${formatNumber(point.p90, 0)})`,
    ),
  ].join('. ')

  return (
    <div className="years" role="img" aria-label={label}>
      {history.map((point) => (
        <div key={point.year} className="year">
          <BarValue value={point.cases} />
          <div className="year-plot">
            {point.cases !== null && (
              <div
                className={`year-bar ${point.estimated ? 'bar-estimated' : 'bar-observed'}`}
                style={{ height: pct(point.cases) }}
              />
            )}
          </div>
          <span className="year-label">{point.year}</span>
        </div>
      ))}
      <div className="years-divider" aria-hidden="true" />
      {projection.map((point) => (
        <div
          key={point.year}
          className="year"
          title={`Entre ${formatNumber(point.p10, 0)} y ${formatNumber(point.p90, 0)}`}
        >
          <BarValue value={point.p50} />
          <div className="year-plot">
            <div className="year-bar bar-projected" style={{ height: pct(point.p50) }} />
            <div
              className="year-range"
              style={{ bottom: pct(point.p10), height: pct(point.p90 - point.p10) }}
            />
          </div>
          <span className="year-label">{point.year}</span>
        </div>
      ))}
    </div>
  )
}

// Abrevia números grandes en miles, igual en servidor y navegador
function compact(value: number): string {
  if (value < 1000) {
    return formatNumber(value, 0)
  }
  return `${formatNumber(value / 1000, value >= 10_000 ? 0 : 1)} mil`
}

// Valor de la barra: número completo en pantallas anchas y abreviado en angostas
function BarValue({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="year-value">
        <span className="value-full">sin datos</span>
        <span className="value-short">—</span>
      </span>
    )
  }
  return (
    <span className="year-value">
      <span className="value-full">{formatNumber(value, 0)}</span>
      <span className="value-short">{compact(value)}</span>
    </span>
  )
}

// Tabla con la proyección de los departamentos principales y su cambio anual
function OutlookTable({ outlook }: { outlook: OutlookDto }) {
  const rows = outlook.departments.slice(0, OUTLOOK_TABLE_ROWS)
  const firstYear = outlook.total.projection[0]?.year
  const lastYear = outlook.total.projection.at(-1)?.year
  const rest = outlook.departments.length - rows.length

  return (
    <div className="outlook-table-wrap">
      <table className="outlook-table">
        <thead>
          <tr>
            <th scope="col">Departamento</th>
            <th scope="col">{firstYear}</th>
            <th scope="col">{lastYear}</th>
            <th scope="col">Cambio anual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.department}>
              <th scope="row">{row.department}</th>
              <td>{formatNumber(row.projection[0]?.p50, 0)}</td>
              <td>{formatNumber(row.projection.at(-1)?.p50, 0)}</td>
              <td>
                <Trend value={row.annual_change_pct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rest > 0 && (
        <p className="text-xs text-muted">
          y {rest} departamento{rest === 1 ? '' : 's'} más con menos casos.
        </p>
      )}
    </div>
  )
}
