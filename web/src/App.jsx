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

  const empty = !busy && uploads.length === 0 && series.length === 0

  return (
    <>
      <header>
        <h1>vigia</h1>
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
          <button onClick={() => fileRef.current?.click()} disabled={busy}>
            Subir
          </button>
          <button className="primary" onClick={onDemo} disabled={busy}>
            Cargar datos demo
          </button>
          <button onClick={refresh} disabled={busy}>
            {busy ? 'Cargando…' : 'Actualizar'}
          </button>
          <button onClick={onReset} disabled={busy} title="Borrar todos los datos ingeridos">
            Borrar datos
          </button>
        </div>
      </header>

      <main>
        {review && (
          <Section title="Revisar mapeo de columnas">
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
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                className="primary"
                onClick={onConfirmReview}
                disabled={
                  busy ||
                  liveMissingRequired.length > 0 ||
                  review.pii_detected.length > 0
                }
              >
                Confirmar e ingestar
              </button>
              <button onClick={onCancelReview} disabled={busy}>
                Cancelar
              </button>
            </div>
          </Section>
        )}

        {error && <div className="error">{error}</div>}

        {empty && (
          <Section title="Sin datos aún">
            <p className="muted">
              Subí un archivo de vigilancia (CSV/XLSX) o cargá el dataset de
              demostración para ver el panel.
            </p>
          </Section>
        )}

        {uploads.length > 0 && (
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
                    <td>{UPLOAD_STATUS_LABELS[row.status] || row.status}</td>
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

        {seriesData.length > 0 && (
          <Section title="Casos semanales (total)">
            <div className="chart">
              <ResponsiveContainer>
                <LineChart data={seriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke={COLORS[0]} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}

        {interannual.length > 0 && (
          <Section title="Comparación interanual (por semana epidemiológica)">
            <div className="chart">
              <ResponsiveContainer>
                <LineChart data={interannual}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epi_week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {interannualYears.map((yr, i) => (
                    <Line
                      key={yr}
                      type="monotone"
                      dataKey={yr}
                      stroke={COLORS[i % COLORS.length]}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}

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
                <BarChart data={ranking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey={ranking[0]?.province ? 'province' : 'department'} width={110} />
                  <Tooltip />
                  <Bar dataKey="cases" fill={COLORS[1]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
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
                    <th>Base</th>
                    <th>Residual</th>
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
                      <td>{row.seasonal_baseline}</td>
                      <td>{row.residual}</td>
                      <td>{row.robust_z.toFixed ? row.robust_z.toFixed(2) : row.robust_z}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        )}

        {forecast && (
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
                    <td>{FORECAST_STATUS_LABELS[row.status] || row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {published.map((dept) => {
              const data = forecast.forecasts
                .filter((f) => f.department === dept.department)
                .map((f) => ({ horizon: f.horizon, p10: f.p10, p50: f.p50, p90: f.p90 }))
              return (
                <div key={dept.department} style={{ marginTop: 12 }}>
                  <div className="muted">{dept.department}</div>
                  <div className="chart" style={{ height: 180 }}>
                    <ResponsiveContainer>
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="horizon" />
                        <YAxis />
                        <Tooltip />
                        <Line dataKey="p50" stroke={COLORS[0]} name="p50" />
                        <Line dataKey="p10" stroke={COLORS[3]} name="p10" strokeDasharray="4 4" />
                        <Line dataKey="p90" stroke={COLORS[2]} name="p90" strokeDasharray="4 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </Section>
        )}

        {explain && explain.drivers.length > 0 && (
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
      </main>

      <footer className="disclaimer">
        {health ? health.disclaimer : 'Herramienta de apoyo a la decisión, no un dispositivo médico.'}
      </footer>
    </>
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
            style={{ background: `rgba(15, 118, 110, ${alpha})` }}
          />
        )
      })}
    </>
  )
}
