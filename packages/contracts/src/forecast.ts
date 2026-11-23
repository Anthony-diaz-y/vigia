import { z } from 'zod'

import { FORECAST_STATUSES } from '@vigia/epidemiology'

import { OutlookSchema } from './recommendations'

export const ForecastStatusSchema = z.enum(FORECAST_STATUSES)

export const ForecastScoreRowSchema = z
  .object({
    department: z.string(),
    province: z.string().optional(),
    windows: z.number().int().nonnegative(),
    mase: z.number().nullable(),
    wis: z.number().nullable(),
    status: ForecastStatusSchema,
  })
  .strict()

export type ForecastScoreRowDto = z.infer<typeof ForecastScoreRowSchema>

export const ForecastQuantileRowSchema = z
  .object({
    department: z.string(),
    province: z.string().optional(),
    horizon: z.number().int().positive(),
    target_year: z.number().int(),
    target_epi_week: z.number().int().min(1).max(53),
    p10: z.number(),
    p50: z.number(),
    p90: z.number(),
  })
  .strict()

export type ForecastQuantileRowDto = z.infer<typeof ForecastQuantileRowSchema>

export const ForecastResponseSchema = z
  .object({
    model_id: z.string().length(16),
    scorecard: z.array(ForecastScoreRowSchema),
    forecasts: z.array(ForecastQuantileRowSchema),
  })
  .strict()

export type ForecastResponse = z.infer<typeof ForecastResponseSchema>

export const IndicatorForecastResponseSchema = z
  .object({
    indicator: z.object({ id: z.string(), label: z.string() }).strict(),
    granularity: z.enum(['week', 'month']).nullable(),
    status: ForecastStatusSchema,
    mase: z.number().nullable(),
    windows: z.number().int().nonnegative(),
    reason: z.string().nullable(),
    history: z.array(z.object({ period: z.string(), value: z.number().nullable() }).strict()),
    forecast: z.array(
      z.object({ period: z.string(), p10: z.number(), p50: z.number(), p90: z.number() }).strict(),
    ),
    outlook: OutlookSchema.nullable(),
  })
  .strict()

export type IndicatorForecastResponse = z.infer<typeof IndicatorForecastResponseSchema>
