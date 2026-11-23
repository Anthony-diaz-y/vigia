'use client'

import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ACCENT, AXIS_LABEL, AXIS_TICK, TOOLTIP_STYLE } from './chart-theme'

export interface WeeklyPoint {
  label: string
  total: number | null
}

// Gráfico de área con el valor de cada periodo (por defecto, casos por semana epidemiológica)
export function WeeklyChart({
  data,
  xLabel = 'Semana epidemiológica (año-S##)',
  yLabel = 'Casos',
}: {
  data: ReadonlyArray<WeeklyPoint>
  xLabel?: string
  yLabel?: string
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={[...data]} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
          <defs>
            <linearGradient id="weekly-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--muted)' }}
            minTickGap={32}
            label={{
              value: xLabel,
              position: 'insideBottom',
              offset: -16,
              style: AXIS_LABEL,
            }}
          />
          <YAxis
            tick={AXIS_TICK}
            label={{
              value: yLabel,
              angle: -90,
              position: 'insideLeft',
              style: { ...AXIS_LABEL, textAnchor: 'middle' },
            }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={{ color: 'var(--text)' }}
            labelStyle={{ color: 'var(--muted)' }}
          />
          <Area
            type="monotone"
            dataKey="total"
            name={yLabel}
            stroke={ACCENT}
            strokeWidth={2}
            fill="url(#weekly-fill)"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
