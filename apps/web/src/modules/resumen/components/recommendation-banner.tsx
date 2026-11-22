import Link from 'next/link'

import type { RecommendationsResponse } from '@vigia/contracts'

import { LEVEL_LABEL } from '@/modules/shared/constants'

// Banner compacto del nivel de alerta para el resumen
export function RecommendationBanner({ data }: { data: RecommendationsResponse }) {
  return (
    <section className={`brief-banner level-${data.overall_level}`}>
      <span className="level-dot" aria-hidden="true" />
      <p className="brief-banner-text">
        <strong>{LEVEL_LABEL[data.overall_level]}.</strong> {data.summary.headline}
      </p>
      <Link href="/recomendaciones" className="btn btn-primary no-underline">
        Ver recomendaciones
      </Link>
    </section>
  )
}
