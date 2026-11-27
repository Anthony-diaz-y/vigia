import { z } from 'zod'

export const UserRoleSchema = z.enum(['admin', 'analyst'])
export type UserRole = z.infer<typeof UserRoleSchema>

const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Escribe un correo válido.')
  .max(254, 'El correo es demasiado largo.')

export const LoginRequestSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1, 'Escribe tu contraseña.').max(200),
  })
  .strict()
export type LoginRequest = z.infer<typeof LoginRequestSchema>

export const SessionUserSchema = z
  .object({
    id: z.number().int(),
    email: z.string(),
    name: z.string(),
    role: UserRoleSchema,
  })
  .strict()
export type SessionUser = z.infer<typeof SessionUserSchema>

export const LoginResponseSchema = z
  .object({
    token: z.string(),
    expires_at: z.string(),
    user: SessionUserSchema,
  })
  .strict()
export type LoginResponse = z.infer<typeof LoginResponseSchema>

export const UserSchema = SessionUserSchema.extend({ created_at: z.string() }).strict()
export type UserDto = z.infer<typeof UserSchema>

export const CreateUserRequestSchema = z
  .object({
    email: EmailSchema,
    name: z.string().trim().min(1, 'Escribe el nombre.').max(80, 'El nombre es demasiado largo.'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres.')
      .max(200, 'La contraseña es demasiado larga.'),
    role: UserRoleSchema,
  })
  .strict()
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>
