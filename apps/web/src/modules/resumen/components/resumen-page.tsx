'use client'

import { useMemo } from 'react'

import type { InterannualRow } from '@vigia/contracts'

import { InterannualChart, WeeklyChart } from '@/modules/shared/components/charts'
import { ErrorBanner, Kpi, Section } from '@/modules/shared/components/ui'
import {
  EMPTY_ANOMALIES,
  EMPTY_SERIES,
  EMPTY_UPLOADS,
  UPLOAD_STATUS_LABELS,
} from '@/modules/shared/constants'
import { useDashboardFilters } from '@/modules/shared/contexts'
import {
  useAnomalies,
  useForecast,
  useRecommendations,
  useSeries,
  useUploads,
} from '@/modules/shared/hooks'
import {
  countSignalWeeks,
  errorMessage,
  flaggedAnomalies,
  formatNumber,
  totalCasesForYear,
} from '@/modules/shared/utils'

import { useInterannual } from '../hooks/use-interannual'
import { toWeeklyPoints } from '../utils/weekly-series'
import { RecommendationBanner } from './recommendation-banner'

const EMPTY_INTERANNUAL: ReadonlyArray<InterannualRow> = []

// Página de resumen: cómo viene la semana, de un vistazo
export function ResumenPage() {
  const { uploadId, year } = useDashboardFilters()

  const seriesQuery = useSeries(uploadId)
  const interannualQuery = useInterannual(uploadId)
  const anomaliesQuery = useAnomalies(uploadId)
  const forecastQuery = useForecast(uploadId)
  const recommendationsQuery = useRecommendations(uploadId)
  const uploadsQuery = useUploads()

  const series = seriesQuery.data ?? EMPTY_SERIES
  const interannual = interannualQuery.data ?? EMPTY_INTERANNUAL
  const anomalies = anomaliesQuery.data ?? EMPTY_ANOMALIES
  const uploads = uploadsQuery.data ?? EMPTY_UPLOADS
  const forecast = forecastQuery.data
  const recommendations = recommendationsQuery.data

  const seriesData = useMemo(() => toWeeklyPoints(series), [series])

  const interannualYears = useMemo(() => {
    const first = interannual[0]
    return first ? Object.keys(first).filter((key) => key !== 'epi_week') : []
  }, [interannual])

  const flagged = useMemo(() => flaggedAnomalies(anomalies), [anomalies])
  const published = useMemo(
    () => (forecast ? forecast.scorecard.filter((row) => row.status === 'publish') : []),
    [forecast],
  )
  const weeksWithSignal = useMemo(() => countSignalWeeks(flagged), [flagged])
  const totalCases = useMemo(() => totalCasesForYear(series, year), [series, year])

  const lastUpload = uploads[0] ?? null
  const failure = seriesQuery.error ?? forecastQuery.error ?? anomaliesQuery.error

  return (
    <>
      {failure && <ErrorBanner message={errorMessage(failure)} />}

      {recommendations && <RecommendationBanner data={recommendations} />}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label={year === null ? 'Casos del año' : `Casos en ${year}`}
          value={formatNumber(totalCases)}
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
              ? `${formatNumber(lastUpload.rows_in)} filas, ${
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
            Cada línea es un año. El año más reciente va en color; los anteriores, en gris.
          </p>
          <InterannualChart data={interannual} years={interannualYears} />
        </Section>
      )}
    </>
  )
}
