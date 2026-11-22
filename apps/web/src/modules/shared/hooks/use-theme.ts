import { useCallback, useEffect, useState } from 'react'

import { THEME_KEY, type Theme } from '../constants/theme'
import { readStoredTheme, systemTheme } from '../utils/theme'

// Maneja el tema claro u oscuro, sincronizado con el atributo del documento
export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(readStoredTheme() ?? systemTheme())
  }, [])

  useEffect(() => {
    if (!theme) {
      return
    }
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  // Alterna entre el tema claro y el oscuro
  const toggleTheme = useCallback(() => {
    setTheme((value) => (value === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
