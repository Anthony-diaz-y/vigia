import type { ReactNode } from 'react'

import type { Tone } from '../../utils'

// Etiqueta de estado con tono ok, advertencia o peligro
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
