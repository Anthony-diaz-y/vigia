import { z } from 'zod'

export const HealthSchema = z
  .object({
    status: z.literal('ok'),
    disclaimer: z.string().min(1),
  })
  .strict()

export type HealthDto = z.infer<typeof HealthSchema>
