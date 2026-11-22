'use client'

import { useMemo } from 'react'

import type { RankingRow } from '@vigia/contracts'

import { ErrorBanner, Kpi, LoadingState, Section } from '@/modules/shared/components/ui'
import { EMPTY_ANOMALIES, EMPTY_SERIES } from '@/modules/shared/constants'
import { useDashboardFilters } from '@/modules/shared/contexts'
import { useAnomalies, useSeries } from '@/modules/shared/hooks'
import {
  countSignalWeeks,
  errorMessage,
  flaggedAnomalies,
  formatNumber,
  totalCasesForYear,
} from '@/modules/shared/utils'

import { useHeatmap, useRanking } from '../hooks/use-analysis-visuals'
import { heatmapPeak } from '../utils/heatmap'
import { AnomaliesCard } from './anomalies-card'
import { HeatmapCard } from './heatmap-card'
import { RankingCard } from './ranking-card'

const EMPTY_RANKING: ReadonlyArray<RankingRow> = []

// Página de análisis: dónde y cuándo se concentran los casos del año elegido
export function AnalisisPage() {
  const { uploadId, year } = useDashboardFilters()

  const seriesQuery = useSeries(uploadId)
  const heatmapQuery = useHeatmap(uploadId, year)
  const rankingQuery = useRanking(uploadId, year)
  const anomaliesQuery = useAnomalies(uploadId)

  const series = seriesQuery.data ?? EMPTY_SERIES
  const ranking = rankingQuery.data ?? EMPTY_RANKING
  const anomalies = anomaliesQuery.data ?? EMPTY_ANOMALIES
  const heatmap = heatmapQuery.data ?? null

  const flagged = useMemo(() => flaggedAnomalies(anomalies), [anomalies])
  const totalCases = useMemo(() => totalCasesForYear(series, year), [series, year])
  const peak = useMemo(() => heatmapPeak(heatmap), [heatmap])
  const weeksWithSignal = useMemo(() => countSignalWeeks(flagged), [flagged])

  const failure =
    heatmapQuery.error ?? rankingQuery.error ?? anomaliesQuery.error ?? seriesQuery.error

  if (year === null) {
    return seriesQuery.isPending ? (
      <LoadingState label="Cargando el análisis…" />
    ) : (
      <Section title="Análisis">
        <p className="text-sm text-muted">El archivo no tiene casos con semana y año válidos.</p>
      </Section>
    )
  }

  if (heatmapQuery.isPending) {
    return <LoadingState label="Cargando el análisis…" />
  }

  return (
    <>
      {failure && <ErrorBanner message={errorMessage(failure)} />}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label={`Casos en ${year}`}
          value={formatNumber(totalCases)}
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
        <Kpi label="Semana más alta" value={formatNumber(peak)} delta="casos en una semana" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HeatmapCard heatmap={heatmap} peak={peak} year={year} />
        <RankingCard ranking={ranking} year={year} />
      </div>

      <AnomaliesCard anomalies={anomalies} flagged={flagged} />
    </>
  )
}
