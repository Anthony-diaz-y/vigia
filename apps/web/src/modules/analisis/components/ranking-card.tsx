'use client'

import { useState } from 'react'

import type { RankingRow } from '@vigia/contracts'

import { Section } from '@/modules/shared/components/ui'
import { formatNumber } from '@/modules/shared/utils'

const RANKING_PREVIEW = 8

// Ranking de departamentos con más casos con barras y opción de ver todos
export function RankingCard({
  ranking,
  year,
}: {
  ranking: ReadonlyArray<RankingRow>
  year: number
}) {
  const [showAll, setShowAll] = useState(false)
  const total = ranking.reduce((sum, row) => sum + (row.cases ?? 0), 0)
  const max = ranking.reduce((peak, row) => Math.max(peak, row.cases ?? 0), 0)
  const visible = showAll ? ranking : ranking.slice(0, RANKING_PREVIEW)

  return (
    <Section title={`Departamentos con más casos en ${year}`}>
      {ranking.length > 0 ? (
        <>
          <div
            className={`mt-3 flex flex-col gap-3.5${showAll ? ' max-h-[420px] overflow-y-auto pr-1' : ''}`}
          >
            {visible.map((row) => {
              const name = row.province || row.department
              const share = total ? (row.cases / total) * 100 : 0
              const width = max ? (row.cases / max) * 100 : 0
              return (
                <div key={`${row.department}-${row.province ?? ''}`} className="rank-row">
                  <span className="rank-name" title={name}>
                    {name}
                  </span>
                  <div className="rank-track">
                    <div className="rank-fill" style={{ width: `${Math.max(width, 1)}%` }} />
                  </div>
                  <span className="rank-value">
                    {formatNumber(row.cases)}
                    <span className="rank-share">{share.toFixed(1)} %</span>
                  </span>
                </div>
              )
            })}
          </div>
          {ranking.length > RANKING_PREVIEW && (
            <button
              type="button"
              className="link-btn mt-4"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
            >
              {showAll ? 'Ver menos' : `Ver los ${ranking.length} departamentos`}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Sin datos de ranking para el año seleccionado.</p>
      )}
    </Section>
  )
}
