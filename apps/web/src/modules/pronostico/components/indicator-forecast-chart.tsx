'use client'

import type { IndicatorForecastResponse } from '@vigia/contracts'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { AXIS_TICK, TOOLTIP_STYLE } from '@/modules/shared/components/charts'

// Gráfico de la historia reciente del indicador y su pronóstico con la banda entre p10 y p90
export function IndicatorForecastChart({
  history,
  forecast,
  label,
}: {
  history: IndicatorForecastResponse['history']
  forecast: IndicatorForecastResponse['forecast']
  label: string
}) {
  const data = [
    ...history.map((point) => ({ period: point.period, observed: point.value })),
    ...forecast.map((point) => ({
      period: point.period,
      expected: point.p50,
      low: point.p10,
      band: point.p90 - point.p10,
    })),
  ]

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'var(--muted)' }} minTickGap={32} />
          <YAxis tick={AXIS_TICK} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area
            dataKey="low"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            legendType="none"
            tooltipType="none"
          />
          <Area
            dataKey="band"
            stackId="band"
            name="Rango probable (80 %)"
            stroke="none"
            fill="var(--accent)"
            fillOpacity={0.18}
            isAnimationActive={false}
          />
          <Line
            dataKey="observed"
            name={label}
            stroke="var(--series-muted-1)"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="expected"
            name="Pronóstico"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
