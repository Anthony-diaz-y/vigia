'use client'

import { useEffect, useState } from 'react'

import { formatNumber } from '../../utils'

const DURATION_MS = 700
const NUMBER_PATTERN = /^\d{1,3}(,\d{3})*$|^\d+$/

// Lee un entero escrito con separadores de miles en español; null si es otro texto
function parseCount(text: string): number | null {
  return NUMBER_PATTERN.test(text) ? Number(text.replace(/,/g, '')) : null
}

// Muestra un número que sube desde cero al aparecer; cualquier otro texto se muestra tal cual
export function CountUp({ value }: { value: string }) {
  const target = parseCount(value)
  const [shown, setShown] = useState(target === null ? value : '0')

  useEffect(() => {
    if (target === null) {
      setShown(value)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || target === 0) {
      setShown(formatNumber(target))
      return
    }
    let frame = 0
    const start = performance.now()
    // Avanza la animación con una curva que frena al final
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1)
      const eased = 1 - (1 - progress) ** 3
      setShown(formatNumber(Math.round(target * eased)))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, value])

  return <span className="tabular-nums">{shown}</span>
}
