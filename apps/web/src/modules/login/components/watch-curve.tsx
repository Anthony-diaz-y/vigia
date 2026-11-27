const WEEKS = 52
const WIDTH = 520
const HEIGHT = 220

// Casos semanales de ejemplo con forma de brote estacional, para la ilustración
function weeklyCases(): number[] {
  return Array.from({ length: WEEKS }, (_, week) => {
    const season = Math.exp(-((week - 15) ** 2) / 40) * 0.95
    const echo = Math.exp(-((week - 38) ** 2) / 30) * 0.35
    const noise = Math.sin(week * 1.7) * 0.035 + Math.cos(week * 0.9) * 0.025
    return Math.max(0.04, season + echo + 0.08 + noise)
  })
}

// Convierte una serie en el trazo SVG de la curva y la posición de su pico
function curve(values: number[]): { line: string; area: string; peak: { x: number; y: number } } {
  const step = WIDTH / (values.length - 1)
  const points = values.map((value, index) => ({ x: index * step, y: HEIGHT - value * HEIGHT }))
  const line = points
    .map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join('')
  const peak = points.reduce((best, point) => (point.y < best.y ? point : best))
  return { line, area: `${line}L${WIDTH},${HEIGHT}L0,${HEIGHT}Z`, peak }
}

// Ilustración del login: una curva epidémica que se dibuja y una línea de vigía que detecta el pico
export function WatchCurve() {
  const { line, area, peak } = curve(weeklyCases())

  return (
    <svg
      className="watch-curve"
      viewBox={`0 -24 ${WIDTH} ${HEIGHT + 48}`}
      role="img"
      aria-label="Curva de casos por semana con el pico señalado"
    >
      <defs>
        <linearGradient id="watch-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          className="watch-grid"
          x1="0"
          x2={WIDTH}
          y1={HEIGHT * ratio}
          y2={HEIGHT * ratio}
        />
      ))}
      {Array.from({ length: 14 }, (_, tick) => (
        <line
          key={tick}
          className="watch-tick"
          x1={(tick * WIDTH) / 13}
          x2={(tick * WIDTH) / 13}
          y1={HEIGHT}
          y2={HEIGHT + 6}
        />
      ))}
      <path className="watch-area" d={area} fill="url(#watch-fill)" />
      <path className="watch-line" d={line} pathLength={1} />
      <g className="watch-scan">
        <line x1="0" x2="0" y1="-16" y2={HEIGHT} />
      </g>
      <g className="watch-peak" transform={`translate(${peak.x} ${peak.y})`}>
        <circle className="watch-peak-ring" r="14" />
        <circle className="watch-peak-dot" r="5" />
        <text className="watch-peak-label" x="14" y="-14">
          Pico detectado
        </text>
      </g>
      <text className="watch-axis" x="0" y={HEIGHT + 22}>
        Semana 1
      </text>
      <text className="watch-axis" x={WIDTH} y={HEIGHT + 22} textAnchor="end">
        Semana 52
      </text>
    </svg>
  )
}
