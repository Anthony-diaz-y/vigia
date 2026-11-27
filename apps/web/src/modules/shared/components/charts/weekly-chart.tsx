'use client'

import {
  Area,
  Bar,
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

const SPARSE_SHARE = 0.4

// Indica si la serie tiene tantos ceros o vacíos que una curva inventaría formas que no existen
export function isSparse(data: ReadonlyArray<WeeklyPoint>): boolean {
  const empty = data.filter((point) => !point.total).length
  return data.length > 0 && empty / data.length >= SPARSE_SHARE
}

// Valor de cada periodo: área si la serie es continua, barras si tiene muchos ceros
export function WeeklyChart({
  data,
  xLabel = 'Semana epidemiológica (año-S##)',
  yLabel = 'Casos',
}: {
  data: ReadonlyArray<WeeklyPoint>
  xLabel?: string
  yLabel?: string
}) {
  const sparse = isSparse(data)
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
          {sparse ? (
            <Bar
              dataKey="total"
              name={yLabel}
              fill={ACCENT}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              animationDuration={700}
            />
          ) : (
            <Area
              type="monotone"
              dataKey="total"
              name={yLabel}
              stroke={ACCENT}
              strokeWidth={2}
              fill="url(#weekly-fill)"
              dot={false}
              animationDuration={900}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
