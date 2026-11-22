'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DISCLAIMER, type UploadPreview } from '@vigia/contracts'

import { endpoints, getToken, setToken } from '@/lib/api'

import { AnomaliesCard, HeatmapCard, RankingCard } from './analysis'
import { InterannualChart, WeeklyChart, type WeeklyPoint } from './charts'
import { ExplanationView } from './explanation'
import { ForecastView } from './forecast'
import { IngestionTable, MappingDialog } from './ingestion'
import { RecommendationBanner, RecommendationsView } from './recommendations'
import { Select, type SelectOption } from './select'
import {
  EmptyState,
  ErrorBanner,
  Kpi,
  CalendarIcon,
  FileIcon,
  Logo,
  MoonIcon,
  NavIcon,
  RefreshIcon,
  Section,
  SunIcon,
  UploadIcon,
  UPLOAD_STATUS_LABELS,
} from './ui'

const VIEWS = [
  { id: 'resumen', label: 'Resumen', description: 'Cómo viene la semana, de un vistazo.' },
  {
    id: 'recomendaciones',
    label: 'Recomendaciones',
    description: 'Dónde actuar primero y qué esperar en los próximos años.',
  },
  { id: 'analisis', label: 'Análisis', description: 'Dónde y cuándo se concentran los casos.' },
  {
    id: 'pronostico',
    label: 'Pronóstico',
    description: 'Casos esperados en las próximas semanas, solo donde el modelo es confiable.',
  },
  {
    id: 'explicacion',
    label: 'Explicación',
    description: 'Qué factores mueven el pronóstico en cada departamento.',
  },
  { id: 'ingesta', label: 'Archivos', description: 'Archivos cargados y la calidad de sus datos.' },
] as const

type ViewId = (typeof VIEWS)[number]['id']

const THEME_KEY = 'vigia-theme'

// Lee la vista activa desde la URL o usa el resumen por defecto
function viewFromUrl(): ViewId {
  const value = new URLSearchParams(window.location.search).get('view')
  return VIEWS.some((view) => view.id === value) ? (value as ViewId) : 'resumen'
}

// Tablero principal: navegación, filtros, carga de archivos y todas las vistas de datos
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
  const [recommendations, setRecommendations] = useState<Awaited<
    ReturnType<typeof endpoints.recommendations>
  > | null>(null)
  const [recoLoading, setRecoLoading] = useState(false)
  const recoRequest = useRef(0)
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

  // Recarga archivos, análisis, pronóstico y recomendaciones del archivo y año activos
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
        setRecommendations(null)
        return
      }

      const ticket = ++recoRequest.current
      setRecoLoading(true)
      endpoints
        .recommendations(activeUploadId)
        .then((next) => {
          if (ticket === recoRequest.current) {
            setRecommendations(next)
          }
        })
        .catch(() => {
          if (ticket === recoRequest.current) {
            setRecommendations(null)
          }
        })
        .finally(() => {
          if (ticket === recoRequest.current) {
            setRecoLoading(false)
          }
        })

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

  useEffect(() => {
    document
      .querySelector('.mobile-nav .nav-btn.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeView])

  useEffect(() => {
    if (series.length > 0 && !series.some((row) => row.year === year)) {
      setYear(Math.max(...series.map((row) => row.year)))
    }
  }, [series, year])

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

  // Pide la vista previa del archivo elegido para revisar el mapeo de columnas
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

  // Sube el archivo con el mapeo confirmado y lo deja como archivo activo
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

  // Borra todos los datos cargados tras pedir confirmación
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

  // Actualiza el token de acceso en el estado y en el almacenamiento local
  const changeToken = (value: string) => {
    setTokenState(value)
    setToken(value)
  }

  // Cambia la vista activa y la refleja en la URL sin recargar
  const changeView = (view: ViewId) => {
    setActiveView(view)
    const url = new URL(window.location.href)
    url.searchParams.set('view', view)
    window.history.replaceState(null, '', url)
  }

  // Renderiza el botón de navegación de una vista
  const nav = (view: (typeof VIEWS)[number]) => (
    <button
      key={view.id}
      type="button"
      className={`nav-btn${activeView === view.id ? ' active' : ''}`}
      onClick={() => changeView(view.id)}
      aria-current={activeView === view.id ? 'page' : undefined}
    >
      <NavIcon name={view.id} />
      <span>{view.label}</span>
    </button>
  )

  const current = VIEWS.find((view) => view.id === activeView) ?? VIEWS[0]
  const usesYear = activeView === 'resumen' || activeView === 'analisis'
  const fileOptions: SelectOption<number>[] = [
    { value: 0, label: 'Todos los archivos', hint: 'Suma de todo lo cargado' },
    ...uploads.map((row) => ({
      value: row.id,
      label: row.filename,
      hint: `${row.rows_in.toLocaleString('es-PE')} filas`,
    })),
  ]
  const yearOptions: SelectOption<number>[] = [...new Set(series.map((row) => row.year))]
    .sort((left, right) => right - left)
    .map((value) => ({ value, label: String(value) }))

  return (
    <div className="flex min-h-screen">
      <aside className="rail" aria-label="Navegación">
        <div className="rail-brand">
          <Logo size={44} />
          <div>
            <span className="rail-brand-name">vigia</span>
            <span className="rail-brand-tag">vigilancia de dengue</span>
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Módulos">
          {VIEWS.map((view) => nav(view))}
        </nav>
        <div className="rail-foot">
          <div>
            <span className="rail-label">Datos cargados</span>
            <span className="rail-file">
              {uploads.length > 0
                ? `${uploads.length} archivo${uploads.length > 1 ? 's' : ''}, ${(
                    lastUpload?.rows_in ?? 0
                  ).toLocaleString('es-PE')} filas`
                : 'Sin datos'}
            </span>
          </div>
          <label>
            <span className="rail-label">Token de acceso</span>
            <input
              type="password"
              className="rail-input"
              value={token}
              autoComplete="off"
              onChange={(event) => changeToken(event.target.value)}
              onBlur={() => void refresh()}
            />
          </label>
          <button
            type="button"
            className="rail-danger"
            onClick={() => void onClear()}
            disabled={busy || uploads.length === 0}
          >
            Borrar todos los datos
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mobile-nav md:hidden" aria-label="Módulos">
          {VIEWS.map((view) => nav(view))}
        </div>

        <header className="topbar">
          <div className="min-w-0 flex-1">
            <h1 className="page-title">{current.label}</h1>
            <p className="page-sub">{current.description}</p>
          </div>
          <div className="toolbar">
            <div className="toolbar-group grow">
              <Select
                label="Archivo a analizar"
                caption="Archivo"
                icon={<FileIcon />}
                value={activeUploadId ?? 0}
                options={fileOptions}
                onChange={(value) => setActiveUploadId(value === 0 ? null : value)}
                disabled={busy || uploads.length === 0}
              />
              {usesYear && yearOptions.length > 0 && (
                <>
                  <span className="toolbar-divider" aria-hidden="true" />
                  <Select
                    label="Año"
                    icon={<CalendarIcon />}
                    value={year}
                    options={yearOptions}
                    onChange={setYear}
                    disabled={busy}
                  />
                </>
              )}
            </div>
            <div className="toolbar-group">
              <button
                type="button"
                className="icon-btn"
                onClick={() => void refresh()}
                disabled={busy}
                data-tip="Actualizar"
                aria-label="Actualizar datos"
              >
                <RefreshIcon spinning={busy} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
                data-tip={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                <span key={theme ?? 'none'} className="theme-icon">
                  {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </span>
              </button>
            </div>
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
              className="btn btn-primary"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <UploadIcon /> Subir archivo
            </button>
            <details className="mobile-settings md:hidden">
              <summary className="btn">Ajustes</summary>
              <div className="mobile-settings-panel">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Token de acceso
                  <input
                    type="password"
                    className="input"
                    value={token}
                    autoComplete="off"
                    onChange={(event) => changeToken(event.target.value)}
                    onBlur={() => void refresh()}
                  />
                </label>
                <button
                  type="button"
                  className="btn text-danger"
                  onClick={() => void onClear()}
                  disabled={busy || uploads.length === 0}
                >
                  Borrar todos los datos
                </button>
              </div>
            </details>
          </div>
          {busy && <div className="loading-bar" role="progressbar" aria-label="Cargando datos" />}
        </header>

        <main className="main">
          {error && <ErrorBanner message={error} />}
          {empty && <EmptyState onUpload={() => fileRef.current?.click()} />}
          <div key={activeView} className="view-enter flex flex-col gap-[18px]">
            {activeView === 'resumen' && uploads.length > 0 && (
              <>
                {recommendations && (
                  <RecommendationBanner
                    data={recommendations}
                    onOpen={() => changeView('recomendaciones')}
                  />
                )}
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <Kpi
                    label={`Casos en ${year}`}
                    value={totalCases.toLocaleString('es-PE')}
                    delta="notificados en el año"
                  />
                  <Kpi
                    label="Semanas fuera de lo esperado"
                    value={weeksWithSignal}
                    delta={
                      flagged.length > 0
                        ? [...new Set(flagged.map((row) => row.department))].join(', ')
                        : 'sin señales'
                    }
                    warn={flagged.length > 0}
                  />
                  <Kpi
                    label="Pronósticos confiables"
                    value={`${published.length} de ${forecast?.scorecard.length ?? 0}`}
                    delta={
                      published.length > 0
                        ? published.map((row) => row.department).join(', ')
                        : 'ninguno supera la prueba de calidad'
                    }
                  />
                  <Kpi
                    label="Último archivo"
                    value={lastUpload ? lastUpload.filename : '—'}
                    small
                    delta={
                      lastUpload
                        ? `${lastUpload.rows_in.toLocaleString('es-PE')} filas, ${
                            UPLOAD_STATUS_LABELS[lastUpload.status] ?? lastUpload.status
                          }`
                        : undefined
                    }
                  />
                </div>

                {seriesData.length > 0 && (
                  <Section title="Casos por semana">
                    <WeeklyChart data={seriesData} />
                  </Section>
                )}

                {interannual.length > 0 && (
                  <Section title="Comparación entre años">
                    <p className="card-sub">
                      Cada línea es un año. El año más reciente va en color; los anteriores, en
                      gris.
                    </p>
                    <InterannualChart data={interannual} years={interannualYears} />
                  </Section>
                )}
              </>
            )}

            {activeView === 'recomendaciones' && uploads.length > 0 && (
              <RecommendationsView data={recommendations} loading={recoLoading} />
            )}

            {activeView === 'analisis' && uploads.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <Kpi
                    label={`Casos en ${year}`}
                    value={totalCases.toLocaleString('es-PE')}
                    delta="acumulado del año"
                  />
                  <Kpi
                    label="Departamentos"
                    value={heatmap ? heatmap.geographies.length : '—'}
                    delta="con datos en el período"
                  />
                  <Kpi
                    label="Semanas fuera de lo esperado"
                    value={weeksWithSignal}
                    delta={weeksWithSignal > 0 ? 'revisar la notificación' : 'sin señales'}
                    warn={weeksWithSignal > 0}
                  />
                  <Kpi
                    label="Semana más alta"
                    value={peakWeekly.toLocaleString('es-PE')}
                    delta="casos en una semana"
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
          </div>
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
