'use client'

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

import { formatNumber } from '../../utils/format'

import { ACCENT, AXIS_LABEL, AXIS_TICK } from './chart-theme'

export interface ForecastPoint {
  horizon: number
  p10: number
  p50: number
  p90: number
  low: number
  band: number
  target: number
}

// Tooltip del pronóstico con los percentiles p10, p50 y p90 del horizonte
function ForecastTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: ForecastPoint }>
}) {
  if (!active || !payload || payload.length === 0) {
    return null
  }
  const point = payload[0]?.payload
  if (!point) {
    return null
  }
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">
        Horizonte S+{point.horizon} · semana {point.target}
      </div>
      <div className="chart-tooltip-row">
        <span>p90</span>
        <strong>{formatNumber(point.p90)}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>p50 (mediana)</span>
        <strong>{formatNumber(point.p50)}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>p10</span>
        <strong>{formatNumber(point.p10)}</strong>
      </div>
    </div>
  )
}

// Gráfico del pronóstico con la mediana y la banda entre p10 y p90
export function ForecastChart({ data }: { data: ReadonlyArray<ForecastPoint> }) {
  return (
    <div className="chart chart-forecast">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={[...data]} margin={{ top: 8, right: 16, bottom: 30, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="horizon"
            tick={AXIS_TICK}
            tickFormatter={(value: number) => `S+${value}`}
            label={{
              value: 'Horizonte (semanas)',
              position: 'insideBottom',
              offset: -18,
              style: AXIS_LABEL,
            }}
          />
          <YAxis
            tick={AXIS_TICK}
            label={{
              value: 'Casos',
              angle: -90,
              position: 'insideLeft',
              style: { ...AXIS_LABEL, textAnchor: 'middle' },
            }}
          />
          <Tooltip content={<ForecastTooltip />} />
          <Area
            type="monotone"
            dataKey="low"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="band"
            stackId="band"
            stroke="none"
            fill={ACCENT}
            fillOpacity={0.18}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            name="p50"
            stroke={ACCENT}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
