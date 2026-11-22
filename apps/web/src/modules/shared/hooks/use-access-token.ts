import { useCallback, useEffect, useState } from 'react'

import { DEFAULT_ACCESS_TOKEN, getAccessToken, setAccessToken } from '../api/token'

// Maneja el token de acceso guardado en el navegador
export function useAccessToken() {
  const [token, setToken] = useState(DEFAULT_ACCESS_TOKEN)

  useEffect(() => {
    setToken(getAccessToken())
  }, [])

  // Actualiza el token en pantalla y en el almacenamiento local
  const changeToken = useCallback((value: string) => {
    setToken(value)
    setAccessToken(value)
  }, [])

  return { token, changeToken }
}
