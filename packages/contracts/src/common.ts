import { z } from 'zod'

/** Fixed, non-negotiable disclaimer shown on every surface. */
export const DISCLAIMER =
  'Herramienta de apoyo a la decisión, no un dispositivo médico. ' +
  'No reemplaza a la autoridad sanitaria.'

export const ACCESS_TOKEN_HEADER = 'x-access-token'

export const ApiErrorSchema = z
  .object({
    detail: z.string(),
  })
  .strict()

export type ApiError = z.infer<typeof ApiErrorSchema>
