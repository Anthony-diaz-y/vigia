import Link from 'next/link'

import type { RecommendationsResponse } from '@vigia/contracts'

import { LEVEL_LABEL } from '@/modules/shared/constants'

// Banner compacto del nivel de alerta; no repite el nivel si el titular ya lo dice
export function RecommendationBanner({ data }: { data: RecommendationsResponse }) {
  const level = LEVEL_LABEL[data.overall_level]
  const repeats = data.summary.headline.toLowerCase().includes(level.toLowerCase())
  return (
    <section className={`brief-banner level-${data.overall_level}`}>
      <span className="level-dot" aria-hidden="true" />
      <p className="brief-banner-text">
        <strong>{repeats ? data.summary.headline : `${level}.`}</strong>
        {repeats ? null : ` ${data.summary.headline}`}
      </p>
      <Link href="/recomendaciones" className="btn btn-primary no-underline">
        Ver recomendaciones
      </Link>
    </section>
  )
}
