'use client'

import { ErrorBanner, LoadingState } from '@/modules/shared/components/ui'
import { LEVEL_LABEL } from '@/modules/shared/constants'
import { useDashboardFilters } from '@/modules/shared/contexts'
import { useRecommendations } from '@/modules/shared/hooks'
import { errorMessage } from '@/modules/shared/utils'

import { windowLabel } from '../utils/window-label'
import { ActionList } from './action-list'
import { OutlookSection } from './outlook-section'

// Página de recomendaciones: resumen, dónde actuar y proyección de los próximos años
export function RecomendacionesPage() {
  const { uploadId } = useDashboardFilters()
  const { data, isError, error, isFetching } = useRecommendations(uploadId)

  if (isError) {
    return <ErrorBanner message={errorMessage(error)} />
  }

  if (!data) {
    return <LoadingState label="Preparando las recomendaciones…" />
  }

  const period = windowLabel(data)

  return (
    <>
      <section className={`brief level-${data.overall_level}`} aria-live="polite">
        <p className="brief-meta">
          <span className="level-dot" aria-hidden="true" />
          <span>
            {LEVEL_LABEL[data.overall_level]}
            {period && <span className="text-muted">, {period}</span>}
          </span>
        </p>
        <h2 className="brief-title">{data.summary.headline}</h2>
        <p className="brief-text">{data.summary.text}</p>
        <p className="brief-source">
          {data.summary.source === 'deepseek'
            ? 'Resumen redactado por IA (DeepSeek) a partir de los datos.'
            : 'Resumen automático a partir de los datos.'}
          {isFetching && ' Actualizando…'}
        </p>
      </section>

      <ActionList items={data.items} />
      <OutlookSection outlook={data.outlook} />

      <p className="brief-footnote">
        Los niveles y las acciones salen de reglas fijas. La IA solo redacta el resumen.
      </p>
    </>
  )
}
