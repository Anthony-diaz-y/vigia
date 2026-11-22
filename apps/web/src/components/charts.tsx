'use client'

import type { CSSProperties } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { InterannualRow } from '@vigia/contracts'

import { formatNumber } from '@/lib/format'

const ACCENT = 'var(--accent)'

const PAST_YEARS = ['var(--series-muted-1)', 'var(--series-muted-2)', 'var(--series-muted-3)']

// Color de cada año: acento para el más reciente y grises para los anteriores
function yearColor(index: number, total: number): string {
  if (index === total - 1) {
    return ACCENT
  }
  return PAST_YEARS[Math.min(total - 2 - index, PAST_YEARS.length - 1)] ?? PAST_YEARS[0]!
}

const TOOLTIP_STYLE: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
  boxShadow: 'var(--shadow-md)',
}

const AXIS_TICK = { fontSize: 11, fill: 'var(--muted)' }
const AXIS_LABEL = { fontSize: 12, fill: 'var(--muted)' }

export interface WeeklyPoint {
  label: string
  total: number
}

// Gráfico de área con el total de casos por semana epidemiológica
export function WeeklyChart({ data }: { data: ReadonlyArray<WeeklyPoint> }) {
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
              value: 'Semana epidemiológica (año-S##)',
              position: 'insideBottom',
              offset: -16,
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
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={{ color: 'var(--text)' }}
            labelStyle={{ color: 'var(--muted)' }}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Casos"
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

// Gráfico de líneas que compara los casos semanales de cada año
export function InterannualChart({
  data,
  years,
}: {
  data: ReadonlyArray<InterannualRow>
  years: ReadonlyArray<string>
}) {
  return (
    <div className="chart chart-tall">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...data]} margin={{ top: 8, right: 24, bottom: 36, left: 16 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="epi_week"
            tick={AXIS_TICK}
            interval={3}
            label={{
              value: 'Semana epidemiológica',
              position: 'insideBottom',
              offset: -22,
              style: AXIS_LABEL,
            }}
          />
          <YAxis
            tick={AXIS_TICK}
            label={{
              value: 'Casos',
              angle: -90,
              position: 'insideLeft',
              offset: 0,
              style: { ...AXIS_LABEL, textAnchor: 'middle' },
            }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={{ color: 'var(--text)' }}
            labelStyle={{ color: 'var(--muted)' }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={36}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingBottom: 12, color: 'var(--muted)' }}
          />
          {years.map((year, index) => (
            <Line
              key={year}
              type="monotone"
              dataKey={year}
              stroke={yearColor(index, years.length)}
              strokeWidth={index === years.length - 1 ? 2.75 : 1.75}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

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
        <strong>{formatNumber(point.p90, 0)}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>p50 (mediana)</span>
        <strong>{formatNumber(point.p50, 0)}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>p10</span>
        <strong>{formatNumber(point.p10, 0)}</strong>
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
              style: { fontSize: 11, fill: 'var(--muted)' },
            }}
          />
          <YAxis
            tick={AXIS_TICK}
            label={{
              value: 'Casos',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11, fill: 'var(--muted)', textAnchor: 'middle' },
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
