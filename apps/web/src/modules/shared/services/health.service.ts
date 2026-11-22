import type { HealthDto } from '@vigia/contracts'

import { apiGet } from '../api'

// Estado del servicio y descargo de responsabilidad vigente
export function fetchHealth(): Promise<HealthDto> {
  return apiGet<HealthDto>('/api/health')
}
