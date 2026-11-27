'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { AXIS_TICK, TOOLTIP_STYLE } from '@/modules/shared/components/charts'
import { Section } from '@/modules/shared/components/ui'
import { formatNumber } from '@/modules/shared/utils'

import { formatBinRange, sparseTicks, type Bin } from '../utils/format-bin'

// Histograma: cuántos registros caen en cada intervalo de un valor medido
export function HistogramWidget({ title, bins }: { title: string; bins: ReadonlyArray<Bin> }) {
  const data = bins.map((bin) => ({ label: formatBinRange(bin, bins), count: bin.count }))
  const ticks = sparseTicks(data.map((item) => item.label))

  return (
    <Section
      title={title.replace(/_/g, ' ')}
      subtitle="Cuántos registros caen en cada rango de valores"
      level={3}
      className="tb-card"
    >
      <div className="chart chart-hist">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              ticks={ticks}
              interval={0}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-grid)' }}
            />
            <YAxis
              tick={AXIS_TICK}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value) => formatNumber(Number(value))}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(label) => `Rango: ${label}`}
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
