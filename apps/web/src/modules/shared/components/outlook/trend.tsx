// Muestra la variación porcentual con flecha y color según suba o baje
export function Trend({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="trend">—</span>
  }
  const tone = value >= 10 ? 'trend-up' : value <= -10 ? 'trend-down' : ''
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : ''
  return (
    <span className={`trend ${tone}`}>
      {arrow} {Math.abs(value)} %
    </span>
  )
}
