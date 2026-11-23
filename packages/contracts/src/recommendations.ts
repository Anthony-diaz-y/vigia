import { z } from 'zod'

import { ALERT_LEVELS, OUTLOOK_CONFIDENCE } from '@vigia/epidemiology'

export const AlertLevelSchema = z.enum(ALERT_LEVELS)

export type AlertLevelDto = z.infer<typeof AlertLevelSchema>

const EpiWeekSchema = z
  .object({
    year: z.number().int(),
    epi_week: z.number().int().min(1).max(53),
  })
  .strict()

export const RecommendationItemSchema = z
  .object({
    department: z.string(),
    level: AlertLevelSchema,
    recent_cases: z.number().nonnegative(),
    previous_cases: z.number().nonnegative(),
    change_pct: z.number().nullable(),
    forecast_cases: z.number().nullable(),
    forecast_change_pct: z.number().nullable(),
    recent_anomalies: z.number().int().nonnegative(),
    reasons: z.array(z.string()),
    actions: z.array(z.string().min(1)),
    actions_source: z.enum(['rules', 'deepseek']),
  })
  .strict()

export type RecommendationItemDto = z.infer<typeof RecommendationItemSchema>

export const RecommendationSummarySchema = z
  .object({
    source: z.enum(['template', 'deepseek']),
    headline: z.string(),
    text: z.string(),
  })
  .strict()

export type RecommendationSummaryDto = z.infer<typeof RecommendationSummarySchema>

const AnnualPointSchema = z
  .object({ year: z.number().int(), cases: z.number().nonnegative(), estimated: z.boolean() })
  .strict()

const ProjectedYearSchema = z
  .object({
    year: z.number().int(),
    p10: z.number().nonnegative(),
    p50: z.number().nonnegative(),
    p90: z.number().nonnegative(),
  })
  .strict()

export const AnnualProjectionSchema = z
  .object({
    history: z.array(AnnualPointSchema),
    projection: z.array(ProjectedYearSchema),
    annual_change_pct: z.number().nullable(),
  })
  .strict()

export type AnnualProjectionDto = z.infer<typeof AnnualProjectionSchema>

export const OutlookSchema = z
  .object({
    horizon_years: z.number().int().positive(),
    complete_years: z.number().int().nonnegative(),
    estimated_years: z.number().int().nonnegative(),
    confidence: z.enum(OUTLOOK_CONFIDENCE),
    total: AnnualProjectionSchema,
    departments: z.array(AnnualProjectionSchema.extend({ department: z.string() }).strict()),
  })
  .strict()

export type OutlookDto = z.infer<typeof OutlookSchema>

export const RecommendationsResponseSchema = z
  .object({
    overall_level: AlertLevelSchema,
    indicator_label: z.string(),
    counts: z.object({ alto: z.number(), medio: z.number(), bajo: z.number() }).strict(),
    window: z.object({ from: EpiWeekSchema, to: EpiWeekSchema }).strict().nullable(),
    summary: RecommendationSummarySchema,
    items: z.array(RecommendationItemSchema),
    outlook: OutlookSchema,
  })
  .strict()

export type RecommendationsResponse = z.infer<typeof RecommendationsResponseSchema>
