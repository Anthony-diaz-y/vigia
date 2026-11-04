import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Area,
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

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function severityOf(z) {
  const value = Number(z)
  if (!Number.isFinite(value)) return { label: '—', cls: 'warn' }
  if (value >= 3) return { label: 'Alta', cls: 'danger' }
  if (value >= 2.5) return { label: 'Media', cls: 'warn' }
  return { label: 'Baja', cls: 'ok' }
}

/** MASE is "better when lower": <1 beats the seasonal baseline at 2x. */
function maseQuality(mase) {
  const value = Number(mase)
  if (!Number.isFinite(value)) return { label: '—', cls: 'warn', width: 0 }
  if (value <= 0.75) return { label: 'Muy bueno', cls: 'ok', width: 100 }
  if (value < 1) return { label: 'Bueno', cls: 'ok', width: 75 }
  if (value < 1.5) return { label: 'Limitado', cls: 'warn', width: 45 }
  return { label: 'Débil', cls: 'danger', width: 22 }
}

function ForecastTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">
        Horizonte S+{point.horizon} · semana {point.target}
      </div>
      <div className="chart-tooltip-row"><span>p90</span><strong>{formatNumber(point.p90, 0)}</strong></div>
      <div className="chart-tooltip-row"><span>p50 (mediana)</span><strong>{formatNumber(point.p50, 0)}</strong></div>
      <div className="chart-tooltip-row"><span>p10</span><strong>{formatNumber(point.p10, 0)}</strong></div>
    </div>
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
  const [showAllRanking, setShowAllRanking] = useState(false)
  const [explainDept, setExplainDept] = useState(null)
  const [activeUploadId, setActiveUploadId] = useState(null)
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
        api.endpoints.series(activeUploadId),
        api.endpoints.interannual(activeUploadId),
        api.endpoints.heatmap(year, activeUploadId),
        api.endpoints.ranking(year, activeUploadId),
        api.endpoints.anomalies(activeUploadId),
        api.endpoints.forecast(activeUploadId),
        api.endpoints.explain(activeUploadId),
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
  }, [year, activeUploadId])

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
      const created = await api.endpoints.upload(reviewFile, mapping)
      if (created && created.id) setActiveUploadId(created.id)
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

  const onReset = async () => {
    if (!window.confirm('¿Borrar todos los datos ingeridos?')) return
    setBusy(true)
    setError(null)
    try {
      await api.endpoints.clear()
      setActiveUploadId(null)
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

  const peakWeekly = useMemo(() => {
    if (!heatmap) return 0
    return Math.max(0, ...heatmap.values.flat())
  }, [heatmap])

  const weeksWithSignal = useMemo(
    () => new Set(flagged.map((row) => `${row.year}-${row.epi_week}`)).size,
    [flagged],
  )

  const rankingTotal = useMemo(
    () => ranking.reduce((acc, row) => acc + (row.cases || 0), 0),
    [ranking],
  )

  const rankingMax = useMemo(
    () => ranking.reduce((acc, row) => Math.max(acc, row.cases || 0), 0),
    [ranking],
  )

  const sortedFlagged = useMemo(
    () => [...flagged].sort((a, b) => Number(b.robust_z) - Number(a.robust_z)),
    [flagged],
  )

  const RANKING_PREVIEW = 8

  const visibleRanking = useMemo(
    () => (showAllRanking ? ranking : ranking.slice(0, RANKING_PREVIEW)),
    [ranking, showAllRanking],
  )

  const heatmapRows = useMemo(() => {
    if (!heatmap) return []
    return heatmap.geographies
      .map((geo, index) => ({ geo, values: heatmap.values[index] }))
      .filter((row) => row.values.some((value) => value > 0))
  }, [heatmap])

  const hiddenHeatmapRows = useMemo(
    () => (heatmap ? heatmap.geographies.length - heatmapRows.length : 0),
    [heatmap, heatmapRows],
  )

  const evaluated = useMemo(
    () => (forecast ? forecast.scorecard.filter((row) => row.windows > 0) : []),
    [forecast],
  )

  const notEvaluated = useMemo(
    () => (forecast ? forecast.scorecard.length - evaluated.length : 0),
    [forecast, evaluated],
  )

  const meanMase = useMemo(() => {
    const values = published
      .map((row) => Number(row.mase))
      .filter((value) => Number.isFinite(value))
    if (values.length === 0) return null
    return values.reduce((acc, value) => acc + value, 0) / values.length
  }, [published])

  const maxHorizon = useMemo(() => {
    if (!forecast || forecast.forecasts.length === 0) return 0
    return Math.max(...forecast.forecasts.map((row) => row.horizon))
  }, [forecast])

  const explainDepartments = useMemo(() => {
    if (!explain) return []
    return [...new Set(explain.drivers.map((row) => row.department))]
  }, [explain])

  const activeExplainDept =
    explainDept && explainDepartments.includes(explainDept)
      ? explainDept
      : explainDepartments[0]

  const activeDrivers = useMemo(() => {
    if (!explain || !activeExplainDept) return []
    return explain.drivers
      .filter((row) => row.department === activeExplainDept)
      .sort((a, b) => a.rank - b.rank)
  }, [explain, activeExplainDept])

  const maxDriverShap = useMemo(
    () => activeDrivers.reduce((acc, row) => Math.max(acc, Number(row.abs_mean_shap) || 0), 0),
    [activeDrivers],
  )

  const activeNarrative = useMemo(() => {
    if (!explain || !activeExplainDept) return null
    return explain.narratives[explainDepartments.indexOf(activeExplainDept)] || null
  }, [explain, activeExplainDept, explainDepartments])

  const topDriversPerDept = useMemo(() => {
    if (!explain || explainDepartments.length === 0) return 0
    return Math.round(explain.drivers.length / explainDepartments.length)
  }, [explain, explainDepartments])

  const dominantDriver = useMemo(() => {
    if (!explain) return ''
    const counts = new Map()
    for (const row of explain.drivers) {
      if (row.rank !== 1) continue
      counts.set(row.driver, (counts.get(row.driver) || 0) + 1)
    }
    let best = ''
    let bestCount = 0
    for (const [name, count] of counts) {
      if (count > bestCount) {
        best = name
        bestCount = count
      }
    }
    return best
  }, [explain])

  const narrativeSource = useMemo(() => {
    if (!explain || explain.narratives.length === 0) return '—'
    const sources = [...new Set(explain.narratives.map((item) => item.source))]
    return sources.length === 1 ? sources[0] : sources.join(' / ')
  }, [explain])

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
            <select
              className="file-select"
              value={activeUploadId ?? ''}
              onChange={(event) =>
                setActiveUploadId(event.target.value ? Number(event.target.value) : null)
              }
              disabled={busy || uploads.length === 0}
              title="Archivo a analizar"
              aria-label="Archivo a analizar"
            >
              <option value="">Todos los archivos</option>
              {uploads.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.filename}
                </option>
              ))}
            </select>
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
                Subí un archivo de vigilancia (CSV/XLSX) para ver el panel de
                análisis y el pronóstico.
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
              <div className="kpis">
                <div className="kpi">
                  <div className="label">Casos notificados</div>
                  <div className="value">{totalCases.toLocaleString('es-PE')}</div>
                  <div className="delta">acumulado {year}</div>
                </div>
                <div className="kpi">
                  <div className="label">Departamentos</div>
                  <div className="value">{heatmap ? heatmap.geographies.length : '—'}</div>
                  <div className="delta">con datos en el período</div>
                </div>
                <div className="kpi">
                  <div className="label">Semanas con señal</div>
                  <div className="value">{weeksWithSignal}</div>
                  <div className={weeksWithSignal > 0 ? 'delta warn' : 'delta'}>
                    {weeksWithSignal > 0 ? 'revisar notificación' : 'sin señales'}
                  </div>
                </div>
                <div className="kpi">
                  <div className="label">Pico semanal</div>
                  <div className="value">{peakWeekly.toLocaleString('es-PE')}</div>
                  <div className="delta">casos en la semana más alta</div>
                </div>
              </div>

              <div className="grid2">
                <Section title="Mapa de calor · departamento × semana">
                  <div className="card-sub">
                    Intensidad de casos notificados en {year}. Cada columna es una
                    semana epidemiológica, cada fila un departamento.
                  </div>
                  {heatmap ? (
                    <>
                      <div className="heatmap-scroll">
                        <div
                          className="heatmap-grid"
                          style={{ gridTemplateColumns: `132px repeat(${heatmap.weeks.length}, 16px)` }}
                        >
                          <div className="hm-corner" />
                          {heatmap.weeks.map((week) => (
                            <div key={`w-${week}`} className="hm-xlabel" title={`Semana ${week}`}>
                              {week % 4 === 1 ? week : ''}
                            </div>
                          ))}
                          {heatmapRows.map(({ geo, values }) => (
                            <Fragment key={geo}>
                              <div className="hm-ylabel" title={geo}>
                                {geo}
                              </div>
                              {values.map((value, cellIndex) => {
                                const alpha = 0.08 + 0.9 * Math.sqrt(value / heatMax)
                                return (
                                  <div
                                    key={`${geo}-${cellIndex}`}
                                    className="hm-cell"
                                    title={`${geo} · semana ${heatmap.weeks[cellIndex]}: ${value} casos`}
                                    style={{ background: `rgba(var(--heat), ${alpha.toFixed(3)})` }}
                                  />
                                )
                              })}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                      <div className="hm-legend">
                        <span className="muted">0</span>
                        <span className="hm-legend-bar" />
                        <span className="muted">{heatMax} casos</span>
                      </div>
                      <div className="card-note">
                        Escala relativa al máximo del período y en raíz cuadrada para
                        que los valores bajos sigan siendo visibles. Las semanas sin
                        notificación aparecen en blanco.
                        {hiddenHeatmapRows > 0 &&
                          ` Se omiten ${hiddenHeatmapRows} departamento${hiddenHeatmapRows > 1 ? 's' : ''} sin casos notificados.`}
                      </div>
                    </>
                  ) : (
                    <p className="muted">Sin datos para el año seleccionado.</p>
                  )}
                </Section>

                <Section title={`Ranking por casos · ${year}`}>
                  {ranking.length > 0 ? (
                    <>
                      <div className={`rank-list${showAllRanking ? ' rank-list-scroll' : ''}`}>
                        {visibleRanking.map((row) => {
                          const name = row.province || row.department
                          const share = rankingTotal ? (row.cases / rankingTotal) * 100 : 0
                          const width = rankingMax ? (row.cases / rankingMax) * 100 : 0
                          return (
                            <div className="rank-item" key={name}>
                              <div className="rank-head">
                                <span className="rank-name">{name}</span>
                                <span className="rank-value">{row.cases.toLocaleString('es-PE')}</span>
                              </div>
                              <div className="rank-track">
                                <div className="rank-fill" style={{ width: `${width}%` }} />
                              </div>
                              <div className="rank-share">{share.toFixed(1)}% del total</div>
                            </div>
                          )
                        })}
                      </div>
                      {ranking.length > RANKING_PREVIEW && (
                        <button
                          type="button"
                          className="btn btn-ghost rank-toggle"
                          onClick={() => setShowAllRanking((value) => !value)}
                          aria-expanded={showAllRanking}
                        >
                          {showAllRanking
                            ? 'Ver menos'
                            : `Ver los ${ranking.length} departamentos`}
                        </button>
                      )}
                      <div className="card-note">
                        Ordenado por casos acumulados del año. Porcentaje sobre el
                        total notificado.
                      </div>
                    </>
                  ) : (
                    <p className="muted">Sin datos de ranking para el año seleccionado.</p>
                  )}
                </Section>
              </div>

              <Section title={`Anomalías detectadas · ${flagged.length} señaladas`}>
                <div className="card-sub">
                  Semanas cuyo volumen se aparta del patrón estacional esperado,
                  sobre todo el período disponible y ordenadas por severidad.
                </div>
                {anomalies.length === 0 ? (
                  <p className="muted">Sin datos de anomalías para el período.</p>
                ) : flagged.length === 0 ? (
                  <p className="muted">
                    Sin anomalías: todas las semanas se mantienen dentro del rango
                    esperado.
                  </p>
                ) : (
                  <>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Severidad</th>
                            <th>Departamento</th>
                            <th>Año</th>
                            <th>Semana</th>
                            <th className="num">Casos</th>
                            <th className="num">Base estacional</th>
                            <th className="num">Residual</th>
                            <th className="num">z robusto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedFlagged.map((row) => (
                            <tr key={`${row.department}-${row.year}-${row.epi_week}`}>
                              <td>
                                <span className={`badge ${severityOf(row.robust_z).cls}`}>
                                  {severityOf(row.robust_z).label}
                                </span>
                              </td>
                              <td>{row.department}</td>
                              <td>{row.year}</td>
                              <td>{row.epi_week}</td>
                              <td className="num">{row.cases}</td>
                              <td className="num">{formatNumber(row.seasonal_baseline, 1)}</td>
                              <td className="num">{formatNumber(row.residual, 1)}</td>
                              <td className="num strong">{formatNumber(row.robust_z, 2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="method-note">
                      <strong>Cómo leerlo.</strong> El <em>z robusto</em> mide cuánto
                      se aparta una semana de su base estacional, en desviaciones
                      robustas (MAD). Valores sobre 2,5 se consideran señal; sobre 3,
                      señal alta. El <em>residual</em> es la diferencia cruda entre los
                      casos observados y la base. Una señal puede deberse a un brote
                      real o a notificación tardía: verificar antes de escalar.
                    </div>
                  </>
                )}
              </Section>
            </>
          )}

          {activeView === 'pronostico' && forecast && (
            <>
              <div className="kpis">
                <div className="kpi">
                  <div className="label">Publicados</div>
                  <div className="value">{published.length} / {forecastTotal}</div>
                  <div className="delta">superan el baseline estacional</div>
                </div>
                <div className="kpi">
                  <div className="label">Evaluados</div>
                  <div className="value">{evaluated.length}</div>
                  <div className="delta">con ventanas de backtest</div>
                </div>
                <div className="kpi">
                  <div className="label">MASE promedio</div>
                  <div className="value">{meanMase === null ? '—' : formatNumber(meanMase, 2)}</div>
                  <div className={meanMase !== null && meanMase < 1 ? 'delta' : 'delta warn'}>
                    {meanMase === null ? 'sin datos' : meanMase < 1 ? 'mejor que el baseline' : 'no supera el baseline'}
                  </div>
                </div>
                <div className="kpi">
                  <div className="label">Horizonte</div>
                  <div className="value">{maxHorizon} <span style={{ fontSize: 15, fontWeight: 500 }}>sem.</span></div>
                  <div className="delta">cuantiles p10 · p50 · p90</div>
                </div>
              </div>

              <Section title="Scorecard de pronóstico">
                <div className="card-sub">
                  Evaluación por departamento con backtest de origen rodante. Un MASE
                  menor a 1 indica mejor desempeño que el baseline estacional
                  (SeasonalNaive de 52 semanas).
                </div>
                {evaluated.length === 0 ? (
                  <p className="muted">
                    Ningún departamento alcanzó el mínimo de ventanas de backtest.
                  </p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Departamento</th>
                          <th className="num">Ventanas</th>
                          <th className="num">MASE</th>
                          <th className="num">WIS</th>
                          <th>Desempeño</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluated.map((row) => {
                          const quality = maseQuality(row.mase)
                          return (
                            <tr key={row.department}>
                              <td>{row.department}</td>
                              <td className="num">{row.windows}</td>
                              <td className="num strong">{formatNumber(row.mase, 3)}</td>
                              <td className="num">{formatNumber(row.wis, 3)}</td>
                              <td>
                                <div className="quality-cell">
                                  <div className="quality-track">
                                    <div
                                      className={`quality-fill ${quality.cls}`}
                                      style={{ width: `${quality.width}%` }}
                                    />
                                  </div>
                                  <span className={`badge ${quality.cls}`}>{quality.label}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`badge ${row.status === 'publish' ? 'ok' : 'warn'}`}>
                                  {FORECAST_STATUS_LABELS[row.status] || row.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {notEvaluated > 0 && (
                  <div className="card-note">
                    {notEvaluated} departamento{notEvaluated > 1 ? 's' : ''} sin evidencia
                    suficiente: no alcanzan el mínimo de ventanas de backtest, por lo
                    que no se publica pronóstico.
                  </div>
                )}
              </Section>

              {published.length > 0 && (
                <Section title="Pronóstico publicado por departamento">
                  <div className="card-sub">
                    La banda sombreada cubre el intervalo p10–p90; la línea central es
                    la mediana (p50). A menor amplitud, mayor certeza.
                  </div>
                  <div className="forecast-grid">
                    {published.map((dept) => {
                      const rows = forecast.forecasts
                        .filter((f) => f.department === dept.department)
                        .sort((a, b) => a.horizon - b.horizon)
                      const chartData = rows.map((f) => ({
                        horizon: f.horizon,
                        p10: f.p10,
                        p50: f.p50,
                        p90: f.p90,
                        low: f.p10,
                        band: f.p90 - f.p10,
                        target: f.target_epi_week,
                      }))
                      return (
                        <article className="forecast-card" key={dept.department}>
                          <header className="forecast-card-head">
                            <h3>{dept.department}</h3>
                            <span className="badge ok">
                              MASE {formatNumber(dept.mase, 2)}
                            </span>
                          </header>
                          <div className="chart chart-forecast">
                            <ResponsiveContainer>
                              <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 30, left: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                                <XAxis
                                  dataKey="horizon"
                                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                                  tickFormatter={(value) => `S+${value}`}
                                  label={{ value: 'Horizonte (semanas)', position: 'insideBottom', offset: -18, style: { fontSize: 11, fill: 'var(--muted)' } }}
                                />
                                <YAxis
                                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                                  label={{ value: 'Casos', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11, fill: 'var(--muted)' } }}
                                />
                                <Tooltip content={<ForecastTooltip />} />
                                <Area type="monotone" dataKey="low" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
                                <Area type="monotone" dataKey="band" stackId="band" stroke="none" fill={COLORS[0]} fillOpacity={0.2} isAnimationActive={false} />
                                <Line type="monotone" dataKey="p50" name="p50" stroke={COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                          <table className="forecast-values">
                            <thead>
                              <tr>
                                <th>Horizonte</th>
                                <th className="num">Semana</th>
                                <th className="num">p10</th>
                                <th className="num">p50</th>
                                <th className="num">p90</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => (
                                <tr key={row.horizon}>
                                  <td>S+{row.horizon}</td>
                                  <td className="num">{row.target_epi_week}</td>
                                  <td className="num">{formatNumber(row.p10, 0)}</td>
                                  <td className="num strong">{formatNumber(row.p50, 0)}</td>
                                  <td className="num">{formatNumber(row.p90, 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </article>
                      )
                    })}
                  </div>
                  <div className="method-note">
                    <strong>Por qué se publica o no.</strong> Solo se publica el pronóstico
                    de los departamentos cuyo MASE en backtest supera al baseline
                    estacional. El resto se marca como <em>evidencia insuficiente</em>
                    para no presentar cifras sin respaldo. El WIS resume el error de la
                    distribución (menor es mejor). Un pronóstico es apoyo a la decisión,
                    no una predicción exacta.
                  </div>
                </Section>
              )}
            </>
          )}

          {activeView === 'explicacion' && explain && explain.drivers.length > 0 && (
            <>
              <div className="kpis">
                <div className="kpi">
                  <div className="label">Departamentos</div>
                  <div className="value">{explainDepartments.length}</div>
                  <div className="delta">con explicación disponible</div>
                </div>
                <div className="kpi">
                  <div className="label">Impulsores</div>
                  <div className="value">{topDriversPerDept}</div>
                  <div className="delta">por departamento</div>
                </div>
                <div className="kpi">
                  <div className="label">Driver dominante</div>
                  <div className="value value-small">{dominantDriver || '—'}</div>
                  <div className="delta">señal más frecuente</div>
                </div>
                <div className="kpi">
                  <div className="label">Narrativa</div>
                  <div className="value value-small">{narrativeSource}</div>
                  <div className="delta">texto generado sobre datos agregados</div>
                </div>
              </div>

              <div className="dept-picker" role="tablist" aria-label="Departamento">
                {explainDepartments.map((dept) => (
                  <button
                    key={dept}
                    role="tab"
                    aria-selected={activeExplainDept === dept}
                    className={`dept-pill${activeExplainDept === dept ? ' active' : ''}`}
                    onClick={() => setExplainDept(dept)}
                  >
                    {dept}
                  </button>
                ))}
              </div>

              <div className="grid2">
                <Section title={`Impulsores · ${activeExplainDept}`}>
                  <div className="card-sub">
                    Contribución media de cada factor al pronóstico, en valor
                    absoluto (escala SHAP sobre el modelo lineal). Una barra más
                    larga implica mayor peso en la explicación.
                  </div>
                  <div className="driver-list">
                    {activeDrivers.map((row) => {
                      const width = maxDriverShap ? (row.abs_mean_shap / maxDriverShap) * 100 : 0
                      const up = row.direction === 'up'
                      return (
                        <div className="driver-item" key={row.feature}>
                          <div className="driver-head">
                            <span className="driver-name">
                              <span className="driver-rank">{row.rank}</span>
                              {row.driver}
                            </span>
                            <span className={`badge ${up ? 'warn' : 'ok'}`}>
                              {up ? '↑ al alza' : '↓ a la baja'}
                            </span>
                          </div>
                          <div className="driver-track">
                            <div
                              className={`driver-fill ${up ? 'up' : 'down'}`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <div className="driver-value">
                            contribución {formatNumber(row.abs_mean_shap, 2)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Section>

                <Section title="Acciones recomendadas">
                  <div className="card-sub">
                    Tabla determinista que traduce cada impulsor en una acción
                    preventiva. El modelo no decide: solo ordena y explica.
                  </div>
                  <ul className="action-list">
                    {activeDrivers.map((row) => (
                      <li className="action-item" key={`a-${row.feature}`}>
                        <div className="action-head">
                          <span className="driver-rank">{row.rank}</span>
                          <span className="action-driver">{row.driver}</span>
                        </div>
                        <p className="action-text">{row.action}</p>
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>

              {activeNarrative && (
                <Section title={`Lectura · ${activeExplainDept}`}>
                  <div className="narrative">
                    <span className="muted">[{activeNarrative.source}]</span>{' '}
                    {activeNarrative.text}
                  </div>
                  <div className="card-note">
                    El texto se redacta sobre un resumen agregado; no aporta cifras
                    nuevas ni reemplaza la revisión del equipo de epidemiología.
                  </div>
                </Section>
              )}
            </>
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
