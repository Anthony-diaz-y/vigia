'use client'

import type { DashboardResponse, WidgetDto } from '@vigia/contracts'

import { InterannualChart, WeeklyChart } from '@/modules/shared/components/charts'
import { ErrorBanner, Kpi, LoadingState, Section } from '@/modules/shared/components/ui'
import { useDashboardFilters } from '@/modules/shared/contexts'
import { useRecommendations } from '@/modules/shared/hooks'
import { errorMessage } from '@/modules/shared/utils'

import { useDashboard } from '../hooks/use-dashboard'
import { fullWidthFlags, groupWidgets, isCompact } from '../utils/group-widgets'
import { BarsWidget } from './bars-widget'
import { DominantWidget } from './dominant-widget'
import { HeatmapWidget } from './heatmap-widget'
import { HistogramWidget } from './histogram-widget'
import { InsightsCard } from './insights-card'
import { ProportionWidget } from './proportion-widget'
import { RecommendationBanner } from './recommendation-banner'
import { TableroSection } from './tablero-section'

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

  const kpis = data.widgets.filter((widget) => widget.type === 'kpis')

  return (
    <>
      {upload && WEEKLY.has(upload.time) && <EpiBanner uploadId={uploadId} indicator={indicator} />}
      {kpis.map((widget) => (
        <div key={widget.id} className="min-w-0">
          <Widget widget={widget} dashboard={data} />
        </div>
      ))}
      {data.insights.length > 0 && (
        <TableroSection
          id="hallazgos"
          title="Hallazgos"
          description="Lo que más destaca en los datos, calculado directamente de ellos."
        >
          <InsightsCard insights={data.insights} />
        </TableroSection>
      )}
      {groupWidgets(data.widgets).map((section) => {
        const compact = section.widgets.filter(isCompact)
        const regular = section.widgets.filter((widget) => !isCompact(widget))
        const full = fullWidthFlags(regular)
        return (
          <TableroSection
            key={section.id}
            id={section.id}
            title={section.title}
            description={section.description}
          >
            {compact.length > 0 && (
              <div className="tb-compact-grid">
                {compact.map((widget) => (
                  <div key={widget.id} className="tb-cell">
                    <Widget widget={widget} dashboard={data} />
                  </div>
                ))}
              </div>
            )}
            {regular.length > 0 && (
              <div className="tb-grid">
                {regular.map((widget, index) => (
                  <div key={widget.id} className={full[index] ? 'tb-cell tb-full' : 'tb-cell'}>
                    <Widget widget={widget} dashboard={data} />
                  </div>
                ))}
              </div>
            )}
          </TableroSection>
        )
      })}
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
        <Section
          title={widget.title}
          subtitle="Valor del indicador en cada periodo."
          level={3}
          className="tb-card"
        >
          <WeeklyChart
            data={widget.points.map((point) => ({ label: point.period, total: point.value }))}
            xLabel={PERIOD_NAMES[dashboard.granularity ?? 'day'] ?? 'Periodo'}
            yLabel={valueLabel}
          />
        </Section>
      )
    case 'interannual':
      return (
        <Section
          title={widget.title}
          subtitle="Cada línea es un año. El más reciente va en color; los anteriores, en gris."
          level={3}
          className="tb-card"
        >
          <InterannualChart
            data={widget.rows}
            years={widget.years}
            xKey="index"
            xLabel={dashboard.granularity === 'month' ? 'Mes' : 'Semana epidemiológica'}
            yLabel={valueLabel}
          />
        </Section>
      )
    case 'breakdown':
      if (widget.variant === 'proportion') {
        return (
          <ProportionWidget
            title={widget.title}
            rows={widget.rows}
            indicatorId={indicatorId}
            unit={valueLabel}
          />
        )
      }
      if (widget.variant === 'dominant') {
        return (
          <DominantWidget
            title={widget.title}
            rows={widget.rows}
            indicatorId={indicatorId}
            unit={valueLabel}
          />
        )
      }
      return <BarsWidget title={widget.title} rows={widget.rows} indicatorId={indicatorId} />
    case 'ranking':
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
