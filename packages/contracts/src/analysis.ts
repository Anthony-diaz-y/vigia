import { z } from 'zod'

export const GeoLevelSchema = z.enum(['department', 'province'])

export type GeoLevel = z.infer<typeof GeoLevelSchema>

export const WeeklySeriesRowSchema = z
  .object({
    department: z.string(),
    province: z.string().optional(),
    year: z.number().int(),
    epi_week: z.number().int().min(1).max(53),
    cases: z.number().nonnegative(),
  })
  .strict()

export type WeeklySeriesRow = z.infer<typeof WeeklySeriesRowSchema>

export const InterannualRowSchema = z
  .object({
    epi_week: z.number().int().min(1).max(53),
  })
  .catchall(z.number().nullable())

export type InterannualRow = z.infer<typeof InterannualRowSchema>

export const HeatmapResponseSchema = z
  .object({
    geographies: z.array(z.string()),
    weeks: z.array(z.number().int().min(1).max(53)),
    values: z.array(z.array(z.number())),
  })
  .strict()

export type HeatmapResponse = z.infer<typeof HeatmapResponseSchema>

export const RankingRowSchema = z
  .object({
    rank: z.number().int().positive(),
    department: z.string(),
    province: z.string().optional(),
    cases: z.number().nonnegative(),
  })
  .strict()

export type RankingRow = z.infer<typeof RankingRowSchema>

export const AnomalyRowSchema = z
  .object({
    department: z.string(),
    province: z.string().optional(),
    year: z.number().int(),
    epi_week: z.number().int().min(1).max(53),
    cases: z.number().nonnegative(),
    seasonal_baseline: z.number(),
    residual: z.number(),
    robust_z: z.number(),
    is_anomaly: z.boolean(),
  })
  .strict()

export type AnomalyRow = z.infer<typeof AnomalyRowSchema>
