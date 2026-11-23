'use client'

import { useState } from 'react'

import type { RecommendationItemDto } from '@vigia/contracts'

import { Section } from '@/modules/shared/components/ui'
import { LEVEL_LABEL } from '@/modules/shared/constants'
import type { IndicatorInfo } from '@/modules/shared/hooks'
import { formatNumber, plural } from '@/modules/shared/utils'

import { Trend } from '@/modules/shared/components/outlook'

const MIN_CASES_FOR_ROW = 10

// Indica si el departamento merece una fila: tiene alerta o suficientes casos recientes
function isRelevant(item: RecommendationItemDto): boolean {
  return item.level !== 'bajo' || item.recent_cases >= MIN_CASES_FOR_ROW
}

// Lista desplegable de departamentos con su nivel, casos y acciones sugeridas
export function ActionList({
  items,
  info,
}: {
  items: ReadonlyArray<RecommendationItemDto>
  info: IndicatorInfo
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [showQuiet, setShowQuiet] = useState(false)

  const relevant = items.filter(isRelevant)
  const quiet = items.filter((item) => !isRelevant(item))

  return (
    <Section title="Dónde actuar">
      <ul className="act-list">
        {relevant.map((item) => {
          const expanded = open === item.department
          return (
            <li key={item.department} className={`act-row level-${item.level}`}>
              <button
                type="button"
                className="act-summary"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : item.department)}
              >
                <span className="act-name">
                  <span className="level-dot" aria-hidden="true" />
                  {item.department}
                </span>
                <span className="act-level">{LEVEL_LABEL[item.level]}</span>
                <span className="act-cases">
                  {formatNumber(item.recent_cases, info.decimals)} {info.unit}{' '}
                  <Trend value={item.change_pct} />
                </span>
                <span className="act-action">{item.actions[0]}</span>
                <span className="act-chevron" aria-hidden="true" />
              </button>
              {expanded && (
                <div className="act-detail">
                  <ul className="act-reasons">
                    {item.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  {item.actions_source === 'deepseek' && (
                    <p className="act-ai">Sugerida por IA, revisar con el equipo.</p>
                  )}
                  {item.actions.length > 1 && (
                    <p className="act-next">
                      También: <span>{item.actions.slice(1).join(' ')}</span>
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {quiet.length > 0 && (
        <div className="act-quiet">
          <button
            type="button"
            className="link-btn"
            aria-expanded={showQuiet}
            onClick={() => setShowQuiet((value) => !value)}
          >
            {showQuiet ? 'Ocultar' : 'Ver'} {quiet.length} {plural(quiet.length, 'departamento')}{' '}
            sin cambios relevantes
          </button>
          {showQuiet && (
            <p className="act-quiet-list">{quiet.map((item) => item.department).join(', ')}</p>
          )}
        </div>
      )}
    </Section>
  )
}
