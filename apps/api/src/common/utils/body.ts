import { UnprocessableEntityException } from '@nestjs/common'
import type { z } from 'zod'

// Valida el cuerpo de una petición con zod y responde 422 con el primer motivo legible
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new UnprocessableEntityException(
      result.error.issues[0]?.message ?? 'Los datos enviados no son válidos.',
    )
  }
  return result.data
}
