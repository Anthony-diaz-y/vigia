'use client'

import { OutlookSection } from '@/modules/shared/components/outlook'
import { ErrorBanner, LoadingState } from '@/modules/shared/components/ui'
import { LEVEL_LABEL } from '@/modules/shared/constants'
import { useDashboardFilters } from '@/modules/shared/contexts'
import { useIndicatorInfo, useRecommendations } from '@/modules/shared/hooks'
import { errorMessage } from '@/modules/shared/utils'

import { windowLabel } from '../utils/window-label'
import { ActionList } from './action-list'

// Página de recomendaciones: resumen, dónde actuar y proyección de los próximos años
export function RecomendacionesPage() {
  const { uploadId, indicator } = useDashboardFilters()
  const info = useIndicatorInfo()
  const { data, isError, error, isFetching } = useRecommendations(uploadId, indicator)

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

      <ActionList items={data.items} info={info} />
      {!info.mean && <OutlookSection outlook={data.outlook} unit={info.unit} />}

      <p className="brief-footnote">
        {data.items.some((item) => item.actions_source === 'deepseek')
          ? 'Los niveles salen de reglas fijas. Las acciones marcadas como sugeridas las propone la IA: revisalas con el equipo.'
          : 'Los niveles y las acciones salen de reglas fijas. La IA solo redacta el resumen.'}
      </p>
    </>
  )
}
