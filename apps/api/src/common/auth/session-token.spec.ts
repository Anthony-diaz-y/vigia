import { describe, expect, it } from 'vitest'

import { hashPassword, verifyPassword } from './password'
import { signSession, verifySession } from './session-token'

const SECRET = 'a-secret-used-only-in-tests'

describe('signSession / verifySession', () => {
  it('acepta una sesión vigente y devuelve sus datos', () => {
    const { token, expiresAt } = signSession({ sub: 7, role: 'analyst' }, SECRET, 60, 1_000_000)
    expect(verifySession(token, SECRET, 1_000_000)).toMatchObject({ sub: 7, role: 'analyst' })
    expect(expiresAt.getTime()).toBe(1_060_000)
  })

  it('rechaza una sesión vencida', () => {
    const { token } = signSession({ sub: 7, role: 'admin' }, SECRET, 60, 0)
    expect(verifySession(token, SECRET, 61_000)).toBeNull()
  })

  it('rechaza otra firma o un contenido alterado', () => {
    const { token } = signSession({ sub: 7, role: 'analyst' }, SECRET, 60)
    expect(verifySession(token, 'otro-secreto-cualquiera')).toBeNull()
    const [, signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ sub: 7, role: 'admin', exp: 9e9 })).toString(
      'base64url',
    )
    expect(verifySession(`${forged}.${signature}`, SECRET)).toBeNull()
    expect(verifySession('basura', SECRET)).toBeNull()
    expect(verifySession(`${token}.extra`, SECRET)).toBeNull()
  })
})

describe('hashPassword / verifyPassword', () => {
  it('verifica la contraseña correcta y rechaza otra', async () => {
    const stored = await hashPassword('clave-segura-123')
    expect(stored.startsWith('scrypt$')).toBe(true)
    expect(stored).not.toContain('clave-segura-123')
    expect(await verifyPassword('clave-segura-123', stored)).toBe(true)
    expect(await verifyPassword('otra-clave', stored)).toBe(false)
  })

  it('genera un hash distinto cada vez y rechaza formatos desconocidos', async () => {
    expect(await hashPassword('x-12345678')).not.toBe(await hashPassword('x-12345678'))
    expect(await verifyPassword('x', 'md5$abc')).toBe(false)
  })
})
