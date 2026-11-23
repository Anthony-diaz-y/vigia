'use client'

import { OutlookSection } from '@/modules/shared/components/outlook'
import { ErrorBanner, Kpi, LoadingState, Section } from '@/modules/shared/components/ui'
import { useDashboardFilters } from '@/modules/shared/contexts'
import { useIndicatorInfo } from '@/modules/shared/hooks'
import { errorMessage, formatNumber } from '@/modules/shared/utils'

import { useIndicatorForecast } from '../hooks/use-indicator-forecast'
import { IndicatorForecastChart } from './indicator-forecast-chart'

const UNIT_LABELS = { week: 'semanas', month: 'meses' } as const

// Pronóstico del indicador elegido del archivo, con su calidad y la proyección anual si aplica
export function IndicatorForecastSection() {
  const { uploadId, indicator } = useDashboardFilters()
  const info = useIndicatorInfo()
  const { data, isError, error } = useIndicatorForecast(uploadId, indicator)

  if (isError) {
    return <ErrorBanner message={errorMessage(error)} />
  }
  if (!data) {
    return <LoadingState label="Calculando el pronóstico…" />
  }

  const published = data.status === 'publish'
  const decimals = data.indicator.id.startsWith('mean:') ? 1 : 0
  const unit = data.granularity ? UNIT_LABELS[data.granularity] : null

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label="Pronóstico"
          value={published ? 'Confiable' : 'No disponible'}
          small
          delta={published ? 'le gana a repetir el año anterior' : (data.reason ?? undefined)}
          warn={!published}
        />
        <Kpi
          label="Error relativo (MASE)"
          value={data.mase === null ? '—' : formatNumber(data.mase, 2)}
          delta={data.windows > 0 ? `${data.windows} pruebas contra el pasado` : 'sin pruebas'}
        />
        <Kpi
          label="Mira hacia adelante"
          value={published && unit ? `${data.forecast.length} ${unit}` : '—'}
          delta={data.indicator.label}
        />
      </div>

      {data.history.length > 0 && (
        <Section title={`${data.indicator.label}: historia y pronóstico`}>
          <div className="card-sub">
            {published
              ? 'La línea gris es lo ocurrido; la azul, lo más probable; la banda, donde caería 8 de cada 10 veces.'
              : 'Se muestra lo ocurrido. El pronóstico aparece cuando el modelo demuestra ser confiable.'}
          </div>
          <IndicatorForecastChart
            history={data.history}
            forecast={data.forecast}
            label={data.indicator.label}
          />
          {published && (
            <table className="data-table mt-2">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th className="num">Mínimo</th>
                  <th className="num">Probable</th>
                  <th className="num">Máximo</th>
                </tr>
              </thead>
              <tbody>
                {data.forecast.map((point) => (
                  <tr key={point.period}>
                    <td>{point.period}</td>
                    <td className="num">{formatNumber(point.p10, decimals)}</td>
                    <td className="num strong">{formatNumber(point.p50, decimals)}</td>
                    <td className="num">{formatNumber(point.p90, decimals)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {data.outlook && <OutlookSection outlook={data.outlook} unit={info.unit} />}
    </>
  )
}
