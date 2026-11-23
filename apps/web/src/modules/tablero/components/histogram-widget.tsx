'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { AXIS_TICK, TOOLTIP_STYLE } from '@/modules/shared/components/charts'
import { Section } from '@/modules/shared/components/ui'
import { formatNumber } from '@/modules/shared/utils'

// Histograma: cuántos registros caen en cada intervalo de un valor medido
export function HistogramWidget({
  title,
  bins,
}: {
  title: string
  bins: ReadonlyArray<{ from: number; to: number; count: number }>
}) {
  const data = bins.map((bin) => ({
    label: `${formatNumber(bin.from, 1)}–${formatNumber(bin.to, 1)}`,
    count: bin.count,
  }))

  return (
    <Section title={title}>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} minTickGap={16} />
            <YAxis tick={AXIS_TICK} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) => [formatNumber(Number(value)), 'Registros']}
            />
            <Bar
              dataKey="count"
              fill="var(--accent)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  )
}
