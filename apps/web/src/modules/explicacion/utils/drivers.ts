import type { ExplainResponse } from '@vigia/contracts'

type DriverRow = ExplainResponse['drivers'][number]

// Factor que aparece más veces en primer lugar entre todos los departamentos
export function dominantDriver(drivers: ReadonlyArray<DriverRow>): string | null {
  const counts = new Map<string, number>()
  for (const row of drivers) {
    if (row.rank === 1) {
      counts.set(row.driver, (counts.get(row.driver) ?? 0) + 1)
    }
  }
  let best: string | null = null
  let bestCount = 0
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}
