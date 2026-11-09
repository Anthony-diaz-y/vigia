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

export const COLORS = ['#0f766e', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#059669']

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

export function WeeklyChart({ data }: { data: ReadonlyArray<WeeklyPoint> }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...data]} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
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
          <Line
            type="monotone"
            dataKey="total"
            name="Casos"
            stroke={COLORS[0]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
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
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
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

export function ForecastChart({ data }: { data: ReadonlyArray<ForecastPoint> }) {
  return (
    <div className="chart chart-forecast">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={[...data]} margin={{ top: 8, right: 16, bottom: 30, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
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
            fill={COLORS[0]}
            fillOpacity={0.2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            name="p50"
            stroke={COLORS[0]}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
