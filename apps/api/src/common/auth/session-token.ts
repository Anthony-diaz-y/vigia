import { createHmac, timingSafeEqual } from 'node:crypto'

export const USER_ROLES = ['admin', 'analyst'] as const
export type UserRole = (typeof USER_ROLES)[number]

export interface SessionClaims {
  sub: number
  role: UserRole
  exp: number
}

// Firma el contenido de la sesión con HMAC-SHA256
function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

// Crea una sesión firmada que vence en los segundos indicados
export function signSession(
  claims: { sub: number; role: UserRole },
  secret: string,
  ttlSeconds: number,
  now: number = Date.now(),
): { token: string; expiresAt: Date } {
  const exp = Math.floor(now / 1000) + ttlSeconds
  const payload = Buffer.from(JSON.stringify({ ...claims, exp })).toString('base64url')
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt: new Date(exp * 1000) }
}

// Valida la firma y el vencimiento de una sesión; null si no es válida
export function verifySession(
  token: string,
  secret: string,
  now: number = Date.now(),
): SessionClaims | null {
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) {
    return null
  }
  const expected = Buffer.from(sign(payload, secret))
  const provided = Buffer.from(signature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims
    const valid =
      Number.isInteger(claims.sub) &&
      USER_ROLES.includes(claims.role) &&
      Number.isFinite(claims.exp) &&
      claims.exp * 1000 > now
    return valid ? claims : null
  } catch {
    return null
  }
}
