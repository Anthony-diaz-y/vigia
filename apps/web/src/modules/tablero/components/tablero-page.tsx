'use client'

import type { DashboardResponse, WidgetDto } from '@vigia/contracts'

import { InterannualChart, WeeklyChart } from '@/modules/shared/components/charts'
import { ErrorBanner, Kpi, LoadingState, Section } from '@/modules/shared/components/ui'
import { useDashboardFilters } from '@/modules/shared/contexts'
import { useRecommendations } from '@/modules/shared/hooks'
import { errorMessage } from '@/modules/shared/utils'

import { useDashboard } from '../hooks/use-dashboard'
import { BarsWidget } from './bars-widget'
import { HeatmapWidget } from './heatmap-widget'
import { HistogramWidget } from './histogram-widget'
import { RecommendationBanner } from './recommendation-banner'

const WIDE: ReadonlySet<WidgetDto['type']> = new Set([
  'kpis',
  'timeseries',
  'interannual',
  'heatmap',
])

const WEEKLY: ReadonlySet<string> = new Set(['date', 'week'])

const PERIOD_NAMES: Readonly<Record<string, string>> = {
  day: 'Día',
  week: 'Semana epidemiológica (año-S##)',
  month: 'Mes (año-mes)',
  year: 'Año',
}

// Página principal: tablero armado según las columnas del archivo elegido
export function TableroPage() {
  const { uploadId, upload, year, yearsReady, indicator } = useDashboardFilters()
  const { data, isError, error } = useDashboard(uploadId, indicator, year, yearsReady)

  if (isError) {
    return <ErrorBanner message={errorMessage(error)} />
  }
  if (!data) {
    return <LoadingState label="Armando el tablero…" />
  }

  return (
    <>
      {upload && WEEKLY.has(upload.time) && <EpiBanner uploadId={uploadId} indicator={indicator} />}
      {data.widgets
        .filter((widget) => WIDE.has(widget.type))
        .map((widget) => (
          <div key={widget.id} className="min-w-0">
            <Widget widget={widget} dashboard={data} />
          </div>
        ))}
      <div className="widget-masonry">
        {data.widgets
          .filter((widget) => !WIDE.has(widget.type))
          .map((widget) => (
            <div key={widget.id} className="widget-masonry-item">
              <Widget widget={widget} dashboard={data} />
            </div>
          ))}
      </div>
    </>
  )
}

// Aviso del nivel de alerta cuando el archivo tiene fechas o semanas
function EpiBanner({ uploadId, indicator }: { uploadId: number | null; indicator: string | null }) {
  const { data } = useRecommendations(uploadId, indicator)
  return data ? <RecommendationBanner data={data} /> : null
}

// Dibuja un widget según su tipo con los datos calculados por la API
function Widget({ widget, dashboard }: { widget: WidgetDto; dashboard: DashboardResponse }) {
  const indicatorId = dashboard.indicator.id
  const valueLabel = dashboard.indicator.label
  switch (widget.type) {
    case 'kpis':
      return (
        <div className="kpi-grid">
          {widget.items.map((item) => (
            <Kpi
              key={item.label}
              label={item.label}
              value={item.value}
              delta={item.hint ?? undefined}
              small={item.value.length > 12}
            />
          ))}
        </div>
      )
    case 'timeseries':
      return (
        <Section title={widget.title}>
          <WeeklyChart
            data={widget.points.map((point) => ({ label: point.period, total: point.value }))}
            xLabel={PERIOD_NAMES[dashboard.granularity ?? 'day'] ?? 'Periodo'}
            yLabel={valueLabel}
          />
        </Section>
      )
    case 'interannual':
      return (
        <Section title={widget.title}>
          <p className="card-sub">
            Cada línea es un año. El más reciente va en color; los anteriores, en gris.
          </p>
          <InterannualChart
            data={widget.rows}
            years={widget.years}
            xKey="index"
            xLabel={dashboard.granularity === 'month' ? 'Mes' : 'Semana epidemiológica'}
            yLabel={valueLabel}
          />
        </Section>
      )
    case 'ranking':
    case 'breakdown':
      return <BarsWidget title={widget.title} rows={widget.rows} indicatorId={indicatorId} />
    case 'heatmap':
      return (
        <HeatmapWidget
          title={widget.title}
          rows={widget.rows}
          columns={widget.columns}
          values={widget.values}
          indicatorId={indicatorId}
        />
      )
    case 'histogram':
      return <HistogramWidget title={widget.title} bins={widget.bins} />
  }
}
