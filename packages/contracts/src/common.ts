import { z } from 'zod'

export const DISCLAIMER =
  'Herramienta de apoyo a la decisión, no un dispositivo médico. ' +
  'No reemplaza a la autoridad sanitaria.'

export const ApiErrorSchema = z
  .object({
    detail: z.string(),
  })
  .strict()

export type ApiError = z.infer<typeof ApiErrorSchema>
