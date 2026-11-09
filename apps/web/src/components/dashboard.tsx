'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DISCLAIMER, type UploadPreview } from '@vigia/contracts'

import { endpoints, getToken, setToken } from '@/lib/api'

import { AnomaliesCard, HeatmapCard, RankingCard } from './analysis'
import { InterannualChart, WeeklyChart, type WeeklyPoint } from './charts'
import { ExplanationView } from './explanation'
import { ForecastView } from './forecast'
import { IngestionTable, MappingDialog } from './ingestion'
import {
  EmptyState,
  ErrorBanner,
  Kpi,
  Logo,
  MoonIcon,
  Section,
  SunIcon,
  UPLOAD_STATUS_LABELS,
} from './ui'

const VIEWS = [
  { id: 'resumen', label: 'Resumen', icon: '◧' },
  { id: 'analisis', label: 'Análisis', icon: '▤' },
  { id: 'pronostico', label: 'Pronóstico', icon: '◔' },
  { id: 'explicacion', label: 'Explicación', icon: '◈' },
  { id: 'ingesta', label: 'Ingesta', icon: '⇪' },
] as const

type ViewId = (typeof VIEWS)[number]['id']

const THEME_KEY = 'vigia-theme'

function viewFromUrl(): ViewId {
  const value = new URLSearchParams(window.location.search).get('view')
  return VIEWS.some((view) => view.id === value) ? (value as ViewId) : 'resumen'
}

export function Dashboard() {
  const [token, setTokenState] = useState('vigia-dev')
  const [health, setHealth] = useState<{ disclaimer: string } | null>(null)
  const [uploads, setUploads] = useState<Awaited<ReturnType<typeof endpoints.uploads>>>([])
  const [series, setSeries] = useState<Awaited<ReturnType<typeof endpoints.series>>>([])
  const [interannual, setInterannual] = useState<Awaited<ReturnType<typeof endpoints.interannual>>>(
    [],
  )
  const [heatmap, setHeatmap] = useState<Awaited<ReturnType<typeof endpoints.heatmap>> | null>(null)
  const [ranking, setRanking] = useState<Awaited<ReturnType<typeof endpoints.ranking>>>([])
  const [anomalies, setAnomalies] = useState<Awaited<ReturnType<typeof endpoints.anomalies>>>([])
  const [forecast, setForecast] = useState<Awaited<ReturnType<typeof endpoints.forecast>> | null>(
    null,
  )
  const [explain, setExplain] = useState<Awaited<ReturnType<typeof endpoints.explain>> | null>(null)
  const [year, setYear] = useState(() => new Date().getFullYear() - 2)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeView, setActiveView] = useState<ViewId>('resumen')
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)
  const [activeUploadId, setActiveUploadId] = useState<number | null>(null)
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [reviewFile, setReviewFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTokenState(getToken())
    setActiveView(viewFromUrl())
    const stored = window.localStorage.getItem(THEME_KEY)
    const current =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    setTheme(current)
  }, [])

  useEffect(() => {
    if (!theme) {
      return
    }
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const [currentHealth, currentUploads] = await Promise.all([
        endpoints.health(),
        endpoints.uploads(),
      ])
      setHealth(currentHealth)
      setUploads(currentUploads)

      if (currentUploads.length === 0) {
        setSeries([])
        setInterannual([])
        setHeatmap(null)
        setRanking([])
        setAnomalies([])
        setForecast(null)
        setExplain(null)
        return
      }

      const [
        nextSeries,
        nextInterannual,
        nextHeatmap,
        nextRanking,
        nextAnomalies,
        nextForecast,
        nextExplain,
      ] = await Promise.all([
        endpoints.series(activeUploadId),
        endpoints.interannual(activeUploadId),
        endpoints.heatmap(year, activeUploadId),
        endpoints.ranking(year, activeUploadId),
        endpoints.anomalies(activeUploadId),
        endpoints.forecast(activeUploadId),
        endpoints.explain(activeUploadId),
      ])
      setSeries(nextSeries)
      setInterannual(nextInterannual)
      setHeatmap(nextHeatmap)
      setRanking(nextRanking)
      setAnomalies(nextAnomalies)
      setForecast(nextForecast)
      setExplain(nextExplain)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }, [year, activeUploadId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const seriesData = useMemo<WeeklyPoint[]>(() => {
    const totals = new Map<string, number>()
    for (const row of series) {
      const key = `${row.year}-S${String(row.epi_week).padStart(2, '0')}`
      totals.set(key, (totals.get(key) ?? 0) + (row.cases ?? 0))
    }
    return [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, total]) => ({ label, total }))
  }, [series])

  const interannualYears = useMemo(() => {
    const first = interannual[0]
    return first ? Object.keys(first).filter((key) => key !== 'epi_week') : []
  }, [interannual])

  const flagged = useMemo(() => anomalies.filter((row) => row.is_anomaly), [anomalies])
  const published = useMemo(
    () => (forecast ? forecast.scorecard.filter((row) => row.status === 'publish') : []),
    [forecast],
  )
  const peakWeekly = useMemo(() => (heatmap ? Math.max(0, ...heatmap.values.flat()) : 0), [heatmap])
  const weeksWithSignal = useMemo(
    () => new Set(flagged.map((row) => `${row.year}-${row.epi_week}`)).size,
    [flagged],
  )
  const totalCases = useMemo(
    () => series.filter((row) => row.year === year).reduce((sum, row) => sum + (row.cases ?? 0), 0),
    [series, year],
  )

  const empty = !busy && uploads.length === 0 && series.length === 0
  const lastUpload = uploads[0] ?? null

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      setPreview(await endpoints.preview(file))
      setReviewFile(file)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const onConfirmUpload = async (mapping: Record<string, string>) => {
    if (!reviewFile) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await endpoints.upload(reviewFile, mapping)
      setActiveUploadId(created.id)
      setPreview(null)
      setReviewFile(null)
      await refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  const onClear = async () => {
    if (!window.confirm('¿Borrar todos los datos ingeridos?')) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await endpoints.clear()
      setActiveUploadId(null)
      await refresh()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  const changeToken = (value: string) => {
    setTokenState(value)
    setToken(value)
  }

  const changeView = (view: ViewId) => {
    setActiveView(view)
    const url = new URL(window.location.href)
    url.searchParams.set('view', view)
    window.history.replaceState(null, '', url)
  }

  const nav = (view: ViewId) => (
    <button
      key={view}
      type="button"
      className={`nav-btn${activeView === view ? ' active' : ''}`}
      onClick={() => changeView(view)}
      aria-current={activeView === view ? 'page' : undefined}
    >
      <span aria-hidden="true">{VIEWS.find((item) => item.id === view)?.icon}</span>
      <span>{VIEWS.find((item) => item.id === view)?.label}</span>
    </button>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col gap-1.5 border-r border-border bg-surface px-3 py-4 md:flex">
        <div className="flex justify-center px-2 pt-2 pb-5">
          <Logo size={64} />
        </div>
        <nav className="flex flex-col gap-1" aria-label="Módulos">
          {VIEWS.map((view) => nav(view.id))}
        </nav>
        <div className="mt-auto px-2 pt-4 text-xs text-muted">
          {uploads.length > 0
            ? `${uploads.length} archivo${uploads.length > 1 ? 's' : ''} · ${lastUpload?.rows_in ?? 0} filas`
            : 'sin datos cargados'}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size={32} />
          </div>
          <span className="hidden text-sm text-muted sm:inline">soporte de decisión en dengue</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="input w-36"
              value={token}
              placeholder="token de acceso"
              aria-label="Token de acceso"
              onChange={(event) => changeToken(event.target.value)}
              onBlur={() => void refresh()}
            />
            <input
              type="number"
              className="input w-24"
              value={year}
              min={2000}
              aria-label="Año para mapa de calor y ranking"
              onChange={(event) => setYear(Number(event.target.value))}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx"
              onChange={onFileSelected}
              className="hidden"
              aria-label="Archivo de vigilancia"
            />
            <button
              type="button"
              className="btn btn-icon btn-ghost"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              Subir
            </button>
            <select
              className="file-select max-w-44"
              value={activeUploadId ?? ''}
              aria-label="Archivo a analizar"
              onChange={(event) =>
                setActiveUploadId(event.target.value ? Number(event.target.value) : null)
              }
              disabled={busy || uploads.length === 0}
            >
              <option value="">Todos los archivos</option>
              {uploads.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.filename}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => void refresh()} disabled={busy}>
              {busy ? 'Cargando…' : 'Actualizar'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void onClear()}
              disabled={busy}
              title="Borrar todos los datos ingeridos"
            >
              Borrar datos
            </button>
          </div>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden">
          {VIEWS.map((view) => nav(view.id))}
        </div>

        <main className="flex flex-1 flex-col gap-4 p-4 md:p-5">
          {error && <ErrorBanner message={error} />}
          {empty && <EmptyState />}

          {activeView === 'resumen' && uploads.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label={`Casos ${year}`}
                  value={totalCases.toLocaleString('es-PE')}
                  delta="total de casos registrados"
                />
                <Kpi
                  label="Anomalías activas"
                  value={flagged.length}
                  delta={
                    flagged.length > 0
                      ? flagged.map((row) => row.department).join(' · ')
                      : 'sin señales'
                  }
                  warn={flagged.length > 0}
                />
                <Kpi
                  label="Pronósticos publicados"
                  value={`${published.length} / ${forecast?.scorecard.length ?? 0}`}
                  delta={
                    published.length > 0
                      ? published.map((row) => row.department).join(' · ')
                      : 'sin publicar'
                  }
                />
                <Kpi
                  label="Última ingesta"
                  value={lastUpload ? lastUpload.filename : '—'}
                  small
                  delta={
                    lastUpload
                      ? `${lastUpload.rows_in} filas · ${
                          UPLOAD_STATUS_LABELS[lastUpload.status] ?? lastUpload.status
                        }`
                      : undefined
                  }
                />
              </div>

              {seriesData.length > 0 && (
                <Section title="Casos semanales (total)">
                  <WeeklyChart data={seriesData} />
                </Section>
              )}

              {interannual.length > 0 && (
                <Section title="Comparación interanual (por semana epidemiológica)">
                  <InterannualChart data={interannual} years={interannualYears} />
                </Section>
              )}
            </>
          )}

          {activeView === 'analisis' && uploads.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  label="Casos notificados"
                  value={totalCases.toLocaleString('es-PE')}
                  delta={`acumulado ${year}`}
                />
                <Kpi
                  label="Departamentos"
                  value={heatmap ? heatmap.geographies.length : '—'}
                  delta="con datos en el período"
                />
                <Kpi
                  label="Semanas con señal"
                  value={weeksWithSignal}
                  delta={weeksWithSignal > 0 ? 'revisar notificación' : 'sin señales'}
                  warn={weeksWithSignal > 0}
                />
                <Kpi
                  label="Pico semanal"
                  value={peakWeekly.toLocaleString('es-PE')}
                  delta="casos en la semana más alta"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <HeatmapCard heatmap={heatmap} year={year} />
                <RankingCard ranking={ranking} year={year} />
              </div>

              <AnomaliesCard anomalies={anomalies} flagged={flagged} />
            </>
          )}

          {activeView === 'pronostico' && forecast && <ForecastView forecast={forecast} />}

          {activeView === 'explicacion' && explain && explain.drivers.length > 0 && (
            <ExplanationView explain={explain} />
          )}

          {activeView === 'ingesta' && uploads.length > 0 && <IngestionTable uploads={uploads} />}
        </main>

        <footer className="disclaimer">{health?.disclaimer ?? DISCLAIMER}</footer>
      </div>

      {preview && (
        <MappingDialog
          preview={preview}
          busy={busy}
          onCancel={() => {
            setPreview(null)
            setReviewFile(null)
          }}
          onConfirm={(mapping) => void onConfirmUpload(mapping)}
        />
      )}
    </div>
  )
}
