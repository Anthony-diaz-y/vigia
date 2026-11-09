import { z } from 'zod'

export const DriverDirectionSchema = z.enum(['up', 'down'])

export const DriverRowSchema = z
  .object({
    department: z.string(),
    province: z.string().optional(),
    rank: z.number().int().positive(),
    feature: z.string().min(1),
    driver: z.string().min(1),
    mean_shap: z.number(),
    abs_mean_shap: z.number(),
    direction: DriverDirectionSchema,
    action: z.string().min(1),
  })
  .strict()

export type DriverRowDto = z.infer<typeof DriverRowSchema>

export const NarrativeSchema = z
  .object({
    source: z.enum(['template', 'deepseek']),
    text: z.string(),
  })
  .strict()

export type NarrativeDto = z.infer<typeof NarrativeSchema>

export const ExplainResponseSchema = z
  .object({
    drivers: z.array(DriverRowSchema),
    narratives: z.array(NarrativeSchema),
  })
  .strict()

export type ExplainResponse = z.infer<typeof ExplainResponseSchema>
