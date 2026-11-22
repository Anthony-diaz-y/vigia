export const DEFAULT_ACCESS_TOKEN = 'vigia-dev'

const TOKEN_KEY = 'vigia-token'

// Obtiene el token de acceso guardado o el de desarrollo por defecto
export function getAccessToken(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_ACCESS_TOKEN
  }
  return window.localStorage.getItem(TOKEN_KEY) || DEFAULT_ACCESS_TOKEN
}

// Guarda el token de acceso en el almacenamiento local
export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(TOKEN_KEY, token)
}
