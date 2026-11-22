'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { InterannualRow } from '@vigia/contracts'

import { AXIS_LABEL, AXIS_TICK, TOOLTIP_STYLE, yearColor } from './chart-theme'

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
