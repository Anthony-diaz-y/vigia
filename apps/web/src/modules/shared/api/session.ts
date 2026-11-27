import { LoginResponseSchema, type LoginResponse } from '@vigia/contracts'

const SESSION_KEY = 'vigia-session'
const listeners = new Set<() => void>()
let cached: { raw: string | null; session: LoginResponse | null } = { raw: null, session: null }
let signedOut = false

// Lee del navegador la sesión guardada; null si no hay, venció o está dañada
export function getSession(): LoginResponse | null {
  if (typeof window === 'undefined') {
    return null
  }
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
  if (raw !== cached.raw) {
    cached = { raw, session: parseSession(raw) }
  }
  const session = cached.session
  return session && Date.parse(session.expires_at) > Date.now() ? session : null
}

// Valida el JSON guardado contra el contrato de la API
function parseSession(raw: string | null): LoginResponse | null {
  if (!raw) {
    return null
  }
  try {
    const result = LoginResponseSchema.safeParse(JSON.parse(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

// Guarda la sesión recién iniciada y avisa a quienes la observan
export function saveSession(session: LoginResponse): void {
  signedOut = false
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Sin almacenamiento la sesión dura solo hasta recargar la página
    cached = { raw: JSON.stringify(session), session }
  }
  notify()
}

// Indica si la última sesión terminó porque el usuario la cerró (no porque venció)
export function wasSignedOut(): boolean {
  return signedOut
}

// Borra la sesión y avisa a quienes la observan; byUser distingue cerrar sesión de una sesión vencida
export function clearSession(byUser = false): void {
  signedOut = byUser
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Nada que borrar si el navegador bloquea el almacenamiento
  }
  cached = { raw: null, session: null }
  notify()
}

// Suscribe un oyente a los cambios de sesión, también desde otras pestañas
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY) {
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

// Avisa a todos los oyentes que la sesión cambió
function notify(): void {
  listeners.forEach((listener) => listener())
}
