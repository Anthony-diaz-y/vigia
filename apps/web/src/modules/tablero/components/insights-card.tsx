import type { InsightDto } from '@vigia/contracts'

const TONE_LABEL: Record<InsightDto['tone'], string> = {
  up: 'Sube',
  down: 'Baja',
  neutral: 'Dato',
}

// Flecha o punto que acompaña cada hallazgo según si el valor sube, baja o es un dato
function ToneMark({ tone }: { tone: InsightDto['tone'] }) {
  return (
    <span className={`insight-mark insight-${tone}`} role="img" aria-label={TONE_LABEL[tone]}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {tone === 'up' && <path d="M7 17L17 7M9 7h8v8" />}
        {tone === 'down' && <path d="M7 7l10 10M17 9v8H9" />}
        {tone === 'neutral' && <circle cx="12" cy="12" r="3" fill="currentColor" />}
      </svg>
    </span>
  )
}

// Hallazgos del archivo en lenguaje simple, calculados por la API sin inventar cifras
export function InsightsCard({ insights }: { insights: InsightDto[] }) {
  return (
    <div className="card insights">
      <ul className="insight-list">
        {insights.map((insight, index) => (
          <li
            key={insight.kind + insight.text}
            className="insight"
            style={{ animationDelay: `${120 + index * 70}ms` }}
          >
            <ToneMark tone={insight.tone} />
            <span>{insight.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
