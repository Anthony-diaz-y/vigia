import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import * as api from './api'

const COLORS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#059669']

const UPLOAD_STATUS_LABELS = { ok: 'OK', ok_with_issues: 'OK con observaciones' }
const FORECAST_STATUS_LABELS = { publish: 'Publicado', insufficient_evidence: 'Evidencia insuficiente' }
const DIRECTION_LABELS = { up: 'sube', down: 'baja' }

const VIEWS = [
  { id: 'resumen', label: 'Resumen', icon: '◧' },
  { id: 'analisis', label: 'Análisis', icon: '▤' },
  { id: 'pronostico', label: 'Pronóstico', icon: '◔' },
  { id: 'explicacion', label: 'Explicación', icon: '◈' },
  { id: 'ingesta', label: 'Ingesta', icon: '⇪' },
]

const THEME_KEY = 'vigia-theme'

function readTheme() {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
  boxShadow: 'var(--shadow-md)',
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

function Section({ title, children }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export default function App() {
  const [token, setToken] = useState(api.getToken())
  const [health, setHealth] = useState(null)
  const [uploads, setUploads] = useState([])
  const [series, setSeries] = useState([])
  const [interannual, setInterannual] = useState([])
  const [heatmap, setHeatmap] = useState(null)
  const [ranking, setRanking] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [forecast, setForecast] = useState(null)
  const [explain, setExplain] = useState(null)
  const [year, setYear] = useState(2024)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [activeView, setActiveView] = useState('resumen')
  const [theme, setTheme] = useState(readTheme)
  const fileRef = useRef(null)
  const [review, setReview] = useState(null)
  const [reviewFile, setReviewFile] = useState(null)
  const [reviewMapping, setReviewMapping] = useState({})

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const [h, u] = await Promise.all([
        api.endpoints.health(),
        api.endpoints.uploads(),
      ])
      setHealth(h)
      setUploads(u)

      if (u.length === 0) {
        setSeries([])
        setInterannual([])
        setHeatmap(null)
        setRanking([])
        setAnomalies([])
        setForecast(null)
        setExplain(null)
        return
      }

      const [s, ia, hm, rk, an, fc, ex] = await Promise.all([
        api.endpoints.series(),
        api.endpoints.interannual(),
        api.endpoints.heatmap(year),
        api.endpoints.ranking(year),
        api.endpoints.anomalies(),
        api.endpoints.forecast(),
        api.endpoints.explain(),
      ])
      setSeries(s)
      setInterannual(ia)
      setHeatmap(hm)
      setRanking(rk)
      setAnomalies(an)
      setForecast(fc)
      setExplain(ex)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [year])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))

  const onTokenChange = (value) => {
    setToken(value)
    api.setToken(value)
  }

  const onFileSelected = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const preview = await api.endpoints.preview(file)
      const initial = {}
      for (const canonical of preview.canonical_columns) {
        initial[canonical] = preview.mapping[canonical] || ''
      }
      setReview(preview)
      setReviewFile(file)
      setReviewMapping(initial)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const onMappingChange = (canonical, sourceHeader) => {
    setReviewMapping((previous) => ({ ...previous, [canonical]: sourceHeader }))
  }

  const onConfirmReview = async () => {
    if (!reviewFile) return
    const mapping = {}
    for (const [canonical, sourceHeader] of Object.entries(reviewMapping)) {
      if (sourceHeader) mapping[canonical] = sourceHeader
    }
    setBusy(true)
    setError(null)
    try {
      await api.endpoints.upload(reviewFile, mapping)
      setReview(null)
      setReviewFile(null)
      setReviewMapping({})
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onCancelReview = () => {
    setReview(null)
    setReviewFile(null)
    setReviewMapping({})
  }

  const onDemo = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.endpoints.loadDemo()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onReset = async () => {
    if (!window.confirm('¿Borrar todos los datos ingeridos?')) return
    setBusy(true)
    setError(null)
    try {
      await api.endpoints.clear()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const seriesData = useMemo(() => {
    const totals = {}
    for (const row of series) {
      const key = `${row.year}-S${String(row.epi_week).padStart(2, '0')}`
      totals[key] = (totals[key] || 0) + (row.cases || 0)
    }
    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, total]) => ({ label, total }))
  }, [series])

  const interannualYears = useMemo(() => {
    if (!interannual.length) return []
    return Object.keys(interannual[0]).filter((key) => key !== 'epi_week')
  }, [interannual])

  const flagged = useMemo(
    () => anomalies.filter((row) => row.is_anomaly),
    [anomalies],
  )

  const published = useMemo(
    () => (forecast ? forecast.scorecard.filter((row) => row.status === 'publish') : []),
    [forecast],
  )

  const heatMax = useMemo(() => {
    if (!heatmap) return 1
    return Math.max(1, ...heatmap.values.flat())
  }, [heatmap])

  const liveMissingRequired = useMemo(() => {
    if (!review) return []
    return review.required.filter((required) => !reviewMapping[required])
  }, [review, reviewMapping])

  const totalCases = useMemo(() => {
    return series
      .filter((row) => row.year === year)
      .reduce((acc, row) => acc + (row.cases || 0), 0)
  }, [series, year])

  const forecastTotal = useMemo(
    () => (forecast ? forecast.scorecard.length : 0),
    [forecast],
  )

  const lastUpload = uploads.length > 0 ? uploads[0] : null

  const empty = !busy && uploads.length === 0 && series.length === 0

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img className="logo logo-lg" src="/logo.webp" alt="vigia" />
        </div>
        <nav>
          {VIEWS.map((view) => (
            <button
              key={view.id}
              className={`nav-btn${activeView === view.id ? ' active' : ''}`}
              onClick={() => setActiveView(view.id)}
            >
              <span className="nav-icon" aria-hidden="true">{view.icon}</span>
              <span>{view.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          {uploads.length > 0
            ? `${uploads.length} archivo${uploads.length > 1 ? 's' : ''} · ${lastUpload ? lastUpload.rows_in : 0} filas`
            : 'sin datos cargados'}
        </div>
      </aside>

      <div className="workspace">
        <header>
          <img className="logo logo-sm" src="/logo.webp" alt="vigia" />
          <span className="muted">soporte de decisión en dengue</span>
          <div className="controls">
            <input
              type="text"
              value={token}
              placeholder="token de acceso"
              onChange={(e) => onTokenChange(e.target.value)}
              onBlur={refresh}
              title="Token de acceso"
            />
            <input
              type="number"
              value={year}
              min={2000}
              onChange={(e) => setYear(Number(e.target.value))}
              title="Año para mapa de calor y ranking"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx"
              onChange={onFileSelected}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-icon btn-ghost"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
              Subir
            </button>
            <button className="btn btn-primary" onClick={onDemo} disabled={busy}>
              Cargar datos demo
            </button>
            <button className="btn" onClick={refresh} disabled={busy}>
              {busy ? 'Cargando…' : 'Actualizar'}
            </button>
            <button
              className="btn btn-danger"
              onClick={onReset}
              disabled={busy}
              title="Borrar todos los datos ingeridos"
            >
              Borrar datos
            </button>
          </div>
        </header>

        <main>
          {error && <div className="error">{error}</div>}

          {empty && (
            <Section title="Sin datos aún">
              <p className="muted">
                Subí un archivo de vigilancia (CSV/XLSX) o cargá el dataset de
                demostración para ver el panel.
              </p>
            </Section>
          )}

          {activeView === 'resumen' && uploads.length > 0 && (
            <>
              <div className="kpis">
                <div className="kpi">
                  <div className="label">Casos {year}</div>
                  <div className="value">{totalCases.toLocaleString('es-PE')}</div>
                  <div className="delta">total de casos registrados</div>
                </div>
                <div className="kpi">
                  <div className="label">Anomalías activas</div>
                  <div className="value">{flagged.length}</div>
                  <div className={flagged.length > 0 ? 'delta warn' : 'delta'}>
                    {flagged.length > 0 ? flagged.map((row) => row.department).join(' · ') : 'sin señales'}
                  </div>
                </div>
                <div className="kpi">
                  <div className="label">Pronósticos publicados</div>
                  <div className="value">{published.length} / {forecastTotal}</div>
                  <div className="delta">
                    {published.length > 0 ? published.map((row) => row.department).join(' · ') : 'sin publicar'}
                  </div>
                </div>
                <div className="kpi">
                  <div className="label">Última ingesta</div>
                  <div className="value value-small">{lastUpload ? lastUpload.filename : '—'}</div>
                  <div className="delta">
                    {lastUpload ? `${lastUpload.rows_in} filas · ${UPLOAD_STATUS_LABELS[lastUpload.status] || lastUpload.status}` : ''}
                  </div>
                </div>
              </div>

              {seriesData.length > 0 && (
                <Section title="Casos semanales (total)">
                  <div className="chart">
                    <ResponsiveContainer>
                      <LineChart data={seriesData} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: 'var(--muted)' }}
                          minTickGap={32}
                          label={{ value: 'Semana epidemiológica (año-S##)', position: 'insideBottom', offset: -16, style: { fontSize: 12, fill: 'var(--muted)' } }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--muted)' }}
                          label={{ value: 'Casos', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 12, fill: 'var(--muted)' } }}
                        />
                        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--text)' }} labelStyle={{ color: 'var(--muted)' }} />
                        <Line type="monotone" dataKey="total" name="Casos" stroke={COLORS[0]} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}

              {interannual.length > 0 && (
                <Section title="Comparación interanual (por semana epidemiológica)">
                  <div className="chart chart-tall">
                    <ResponsiveContainer>
                      <LineChart data={interannual} margin={{ top: 8, right: 24, bottom: 36, left: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                        <XAxis
                          dataKey="epi_week"
                          tick={{ fontSize: 11, fill: 'var(--muted)' }}
                          interval={3}
                          label={{ value: 'Semana epidemiológica', position: 'insideBottom', offset: -22, style: { fontSize: 12, fill: 'var(--muted)' } }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--muted)' }}
                          label={{ value: 'Casos', angle: -90, position: 'insideLeft', offset: 0, style: { textAnchor: 'middle', fontSize: 12, fill: 'var(--muted)' } }}
                        />
                        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--text)' }} labelStyle={{ color: 'var(--muted)' }} />
                        <Legend verticalAlign="top" align="right" height={36} iconType="plainline" wrapperStyle={{ fontSize: 12, paddingBottom: 12, color: 'var(--muted)' }} />
                        {interannualYears.map((yr, i) => (
                          <Line
                            key={yr}
                            type="monotone"
                            dataKey={yr}
                            stroke={COLORS[i % COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              )}
            </>
          )}

          {activeView === 'analisis' && uploads.length > 0 && (
            <>
              {(heatmap || ranking.length > 0) && (
                <div className="grid2">
                  {heatmap && (
                    <Section title={`Mapa de calor por departamento y semana (${year})`}>
                      <div className="heatmap" style={{ gridTemplateColumns: `auto repeat(${heatmap.weeks.length}, 14px)` }}>
                        <div className="row-label" />
                        {heatmap.weeks.map((week) => (
                          <div key={week} className="row-label muted" title={`semana ${week}`}>
                            {week}
                          </div>
                        ))}
                        {heatmap.geographies.map((geo, rowIndex) => (
                          <HeatmapRow
                            key={geo}
                            label={geo}
                            values={heatmap.values[rowIndex]}
                            max={heatMax}
                          />
                        ))}
                      </div>
                    </Section>
                  )}

                  {ranking.length > 0 && (
                    <Section title={`Ranking por casos${year ? ` (${year})` : ''}`}>
                      <div className="chart">
                        <ResponsiveContainer>
                          <BarChart data={ranking} layout="vertical" margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 11, fill: 'var(--muted)' }}
                              label={{ value: 'Casos', position: 'insideBottom', offset: -14, style: { fontSize: 12, fill: 'var(--muted)' } }}
                            />
                            <YAxis
                              type="category"
                              dataKey={ranking[0]?.province ? 'province' : 'department'}
                              width={110}
                              tick={{ fontSize: 11, fill: 'var(--muted)' }}
                            />
                            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--text)' }} labelStyle={{ color: 'var(--muted)' }} cursor={{ fill: 'var(--surface-2)' }} />
                            <Bar dataKey="cases" name="Casos" fill={COLORS[1]} radius={[0, 3, 3, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Section>
                  )}
                </div>
              )}

              {anomalies.length > 0 && (
                <Section title={`Anomalías (${flagged.length} señaladas)`}>
                  {flagged.length === 0 ? (
                    <p className="muted">Sin anomalías para los datos actuales.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Departamento</th>
                          <th>Año</th>
                          <th>Semana</th>
                          <th>Casos</th>
                          <th>z robusto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flagged.map((row, i) => (
                          <tr key={i}>
                            <td>{row.department}</td>
                            <td>{row.year}</td>
                            <td>{row.epi_week}</td>
                            <td>{row.cases}</td>
                            <td>
                              <span className="badge danger">
                                {row.robust_z.toFixed ? row.robust_z.toFixed(2) : row.robust_z}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Section>
              )}
            </>
          )}

          {activeView === 'pronostico' && forecast && (
            <>
              <Section title="Scorecard de pronóstico">
                <table>
                  <thead>
                    <tr>
                      <th>Departamento</th>
                      <th>Ventanas</th>
                      <th>MASE</th>
                      <th>WIS</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.scorecard.map((row) => (
                      <tr key={row.department}>
                        <td>{row.department}</td>
                        <td>{row.windows}</td>
                        <td>{row.mase == null ? '—' : row.mase.toFixed(3)}</td>
                        <td>{row.wis == null ? '—' : row.wis.toFixed(3)}</td>
                        <td>
                          <span className={`badge ${row.status === 'publish' ? 'ok' : 'warn'}`}>
                            {FORECAST_STATUS_LABELS[row.status] || row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {published.length > 0 && (
                <Section title="Pronóstico por departamento">
                  {published.map((dept) => {
                    const data = forecast.forecasts
                      .filter((f) => f.department === dept.department)
                      .map((f) => ({ horizon: f.horizon, p10: f.p10, p50: f.p50, p90: f.p90 }))
                    return (
                      <div key={dept.department} style={{ marginTop: 12 }}>
                        <div className="muted">{dept.department}</div>
                        <div className="chart" style={{ height: 180 }}>
                          <ResponsiveContainer>
                            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                              <XAxis
                                dataKey="horizon"
                                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                                label={{ value: 'Horizonte (semanas)', position: 'insideBottom', offset: -16, style: { fontSize: 11, fill: 'var(--muted)' } }}
                              />
                              <YAxis
                                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                                label={{ value: 'Casos', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11, fill: 'var(--muted)' } }}
                              />
                              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--text)' }} labelStyle={{ color: 'var(--muted)' }} />
                              <Line dataKey="p50" name="p50" stroke={COLORS[0]} strokeWidth={2} />
                              <Line dataKey="p10" name="p10" stroke={COLORS[3]} strokeDasharray="4 4" dot={false} />
                              <Line dataKey="p90" name="p90" stroke={COLORS[2]} strokeDasharray="4 4" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )
                  })}
                </Section>
              )}
            </>
          )}

          {activeView === 'explicacion' && explain && explain.drivers.length > 0 && (
            <Section title="Principales impulsores por departamento">
              <table>
                <thead>
                  <tr>
                    <th>Departamento</th>
                    <th>Posición</th>
                    <th>Impulsor</th>
                    <th>Dirección</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {explain.drivers.map((row, i) => (
                    <tr key={i}>
                      <td>{row.department}</td>
                      <td>{row.rank}</td>
                      <td>{row.driver}</td>
                      <td>{DIRECTION_LABELS[row.direction] || row.direction}</td>
                      <td>{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {explain.narratives.map((item, i) => (
                <div className="narrative" key={i}>
                  <span className="muted">[{item.source}]</span> {item.text}
                </div>
              ))}
            </Section>
          )}

          {activeView === 'ingesta' && uploads.length > 0 && (
            <Section title={`Archivos ingeridos (${uploads.length})`}>
              <table>
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Estado</th>
                    <th>Filas leídas</th>
                    <th>Válidas</th>
                    <th>Descartadas</th>
                    <th>Duplicadas</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((row) => (
                    <tr key={row.id}>
                      <td>{row.filename}</td>
                      <td>
                        <span className={`badge ${row.status === 'ok' ? 'ok' : 'warn'}`}>
                          {UPLOAD_STATUS_LABELS[row.status] || row.status}
                        </span>
                      </td>
                      <td>{row.rows_in}</td>
                      <td>{row.rows_valid}</td>
                      <td>{row.rows_dropped}</td>
                      <td>{row.duplicates_collapsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </main>

        <footer className="disclaimer">
          {health ? health.disclaimer : 'Herramienta de apoyo a la decisión, no un dispositivo médico.'}
        </footer>
      </div>

      {review && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Revisar mapeo de columnas</h2>
            <p className="muted">
              Confirmá cómo se mapean las columnas del archivo a las canónicas
              antes de ingestar. Podés reasignar cualquier columna.
            </p>
            {review.pii_detected.length > 0 && (
              <div className="error">
                El archivo contiene columnas de datos personales (
                {review.pii_detected.join(', ')}) y no puede ingerirse.
              </div>
            )}
            {liveMissingRequired.length > 0 && (
              <div className="error">
                Faltan columnas requeridas: {liveMissingRequired.join(', ')}
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>Columna canónica</th>
                  <th>Columna del archivo</th>
                </tr>
              </thead>
              <tbody>
                {review.canonical_columns.map((canonical) => (
                  <tr key={canonical}>
                    <td>
                      {canonical}
                      {review.required.includes(canonical) && (
                        <span className="muted"> *</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={reviewMapping[canonical] || ''}
                        onChange={(e) => onMappingChange(canonical, e.target.value)}
                      >
                        <option value="">(sin mapear)</option>
                        {review.columns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {review.unmapped_columns.length > 0 && (
              <p className="muted">
                Columnas del archivo sin mapear: {review.unmapped_columns.join(', ')}
              </p>
            )}
            <div className="modal-actions">
              <button className="btn" onClick={onCancelReview} disabled={busy}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={onConfirmReview}
                disabled={
                  busy ||
                  liveMissingRequired.length > 0 ||
                  review.pii_detected.length > 0
                }
              >
                Confirmar e ingestar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HeatmapRow({ label, values, max }) {
  return (
    <>
      <div className="row-label">{label}</div>
      {values.map((value, i) => {
        const intensity = value / max
        const alpha = 0.08 + 0.9 * intensity
        return (
          <div
            key={i}
            className="cell"
            title={value}
            style={{ background: `rgba(var(--heat), ${alpha})` }}
          />
        )
      })}
    </>
  )
}
