import { z } from 'zod'

export const GranularitySchema = z.enum(['day', 'week', 'month', 'year'])

const NamedValueSchema = z.object({ name: z.string(), value: z.number() }).strict()

export const KpiSchema = z
  .object({ label: z.string(), value: z.string(), hint: z.string().nullable() })
  .strict()

export const WidgetSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('kpis'),
    id: z.string(),
    title: z.string(),
    items: z.array(KpiSchema),
  }),
  z.object({
    type: z.literal('timeseries'),
    id: z.string(),
    title: z.string(),
    points: z.array(z.object({ period: z.string(), value: z.number().nullable() }).strict()),
  }),
  z.object({
    type: z.literal('interannual'),
    id: z.string(),
    title: z.string(),
    years: z.array(z.string()),
    rows: z.array(z.record(z.string(), z.number().nullable())),
  }),
  z.object({
    type: z.literal('ranking'),
    id: z.string(),
    title: z.string(),
    rows: z.array(NamedValueSchema),
  }),
  z.object({
    type: z.literal('heatmap'),
    id: z.string(),
    title: z.string(),
    rows: z.array(z.string()),
    columns: z.array(z.string()),
    values: z.array(z.array(z.number().nullable())),
  }),
  z.object({
    type: z.literal('breakdown'),
    id: z.string(),
    title: z.string(),
    rows: z.array(NamedValueSchema),
  }),
  z.object({
    type: z.literal('histogram'),
    id: z.string(),
    title: z.string(),
    bins: z.array(z.object({ from: z.number(), to: z.number(), count: z.number() }).strict()),
  }),
])

export type WidgetDto = z.infer<typeof WidgetSchema>

export const InsightSchema = z
  .object({
    kind: z.enum(['trend', 'peak', 'comparison', 'concentration', 'dominant']),
    tone: z.enum(['up', 'down', 'neutral']),
    text: z.string(),
  })
  .strict()

export type InsightDto = z.infer<typeof InsightSchema>

export const DashboardResponseSchema = z
  .object({
    title: z.string(),
    topic: z.string(),
    indicator: z.object({ id: z.string(), label: z.string() }).strict(),
    indicators: z.array(z.object({ id: z.string(), label: z.string() }).strict()),
    granularity: GranularitySchema.nullable(),
    years: z.array(z.number().int()),
    widgets: z.array(WidgetSchema),
    insights: z.array(InsightSchema),
  })
  .strict()

export type DashboardResponse = z.infer<typeof DashboardResponseSchema>
