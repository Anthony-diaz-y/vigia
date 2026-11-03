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

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const [h, u, s, ia, hm, rk, an, fc, ex] = await Promise.all([
        api.endpoints.health(),
        api.endpoints.uploads(),
        api.endpoints.series(),
        api.endpoints.interannual(),
        api.endpoints.heatmap(year),
        api.endpoints.ranking(year),
        api.endpoints.anomalies(),
        api.endpoints.forecast(),
        api.endpoints.explain(),
      ])
      setHealth(h)
      setUploads(u)
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

  const onUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await api.endpoints.upload(file)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      event.target.value = ''
    }
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

  const seriesData = useMemo(() => {
    const totals = {}
    for (const row of series) {
      const key = `${row.year}-W${String(row.epi_week).padStart(2, '0')}`
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

  const empty = !busy && uploads.length === 0 && series.length === 0

  return (
    <>
      <header>
        <h1>vigia</h1>
        <span className="muted">dengue decision support</span>
        <div className="controls">
          <input
            type="text"
            value={token}
            placeholder="access token"
            onChange={(e) => onTokenChange(e.target.value)}
            onBlur={refresh}
            title="Access token"
          />
          <input
            type="number"
            value={year}
            min={2000}
            onChange={(e) => setYear(Number(e.target.value))}
            title="Year for heatmap and ranking"
          />
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.xlsx"
            onChange={onUpload}
            style={{ display: 'none' }}
          />
          <button onClick={() => fileRef.current?.click()} disabled={busy}>
            Upload
          </button>
          <button className="primary" onClick={onDemo} disabled={busy}>
            Load demo data
          </button>
          <button onClick={refresh} disabled={busy}>
            {busy ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      <main>
        {error && <div className="error">{error}</div>}

        {empty && (
          <Section title="No data yet">
            <p className="muted">
              Upload a surveillance export (CSV/XLSX) or load the synthetic demo
              dataset to see the dashboard.
            </p>
          </Section>
        )}

        {uploads.length > 0 && (
          <Section title={`Ingested files (${uploads.length})`}>
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Status</th>
                  <th>Rows in</th>
                  <th>Valid</th>
                  <th>Dropped</th>
                  <th>Duplicates</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((row) => (
                  <tr key={row.id}>
                    <td>{row.filename}</td>
                    <td>{row.status}</td>
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
          <Section title="Weekly cases (total)">
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
          <Section title="Interannual comparison (by epidemiological week)">
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
          <Section title={`Heatmap by department and week (${year})`}>
            <div className="heatmap" style={{ gridTemplateColumns: `auto repeat(${heatmap.weeks.length}, 14px)` }}>
              <div className="row-label" />
              {heatmap.weeks.map((week) => (
                <div key={week} className="row-label muted" title={`week ${week}`}>
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
          <Section title={`Ranking by cases${year ? ` (${year})` : ''}`}>
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
          <Section title={`Anomalies (${flagged.length} flagged)`}>
            {flagged.length === 0 ? (
              <p className="muted">No anomaly flags for the current data.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Year</th>
                    <th>Week</th>
                    <th>Cases</th>
                    <th>Baseline</th>
                    <th>Residual</th>
                    <th>Robust z</th>
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
          <Section title="Forecast scorecard">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Windows</th>
                  <th>MASE</th>
                  <th>WIS</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {forecast.scorecard.map((row) => (
                  <tr key={row.department}>
                    <td>{row.department}</td>
                    <td>{row.windows}</td>
                    <td>{row.mase == null ? '—' : row.mase.toFixed(3)}</td>
                    <td>{row.wis == null ? '—' : row.wis.toFixed(3)}</td>
                    <td>{row.status}</td>
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
          <Section title="Top drivers per department">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Rank</th>
                  <th>Driver</th>
                  <th>Direction</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {explain.drivers.map((row, i) => (
                  <tr key={i}>
                    <td>{row.department}</td>
                    <td>{row.rank}</td>
                    <td>{row.feature}</td>
                    <td>{row.direction}</td>
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
        {health ? health.disclaimer : 'Decision-support tool, not a medical device.'}
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
