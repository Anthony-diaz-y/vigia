import { useState } from 'react'

// Año elegido: el del usuario si sigue disponible, si no el más reciente con datos
export function useSelectedYear(years: ReadonlyArray<number>) {
  const [picked, setPicked] = useState<number | null>(null)
  const latest = years.length > 0 ? Math.max(...years) : null
  const year = picked !== null && years.includes(picked) ? picked : latest
  return [year, setPicked] as const
}
