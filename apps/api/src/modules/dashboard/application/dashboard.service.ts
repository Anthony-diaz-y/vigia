import { Inject, Injectable } from '@nestjs/common'
import type { DashboardResponse } from '@vigia/contracts'
import { parseIndicator } from '@vigia/epidemiology'

import { buildDashboard } from '../domain/dashboard-data'
import { DashboardRepository } from '../infrastructure/dashboard.repository'

@Injectable()
export class DashboardService {
  constructor(@Inject(DashboardRepository) private readonly repository: DashboardRepository) {}

  // Arma el tablero de una carga para el indicador y el año pedidos
  async dashboard(uploadId: number, indicator?: string, year?: number): Promise<DashboardResponse> {
    const dataset = await this.repository.dataset(uploadId)
    return buildDashboard({
      ...dataset,
      indicator: parseIndicator(indicator, dataset.columns),
      year: year ?? null,
    })
  }

  // Devuelve los años con datos de una carga, del más reciente al más antiguo
  async years(uploadId: number): Promise<number[]> {
    return this.repository.years(uploadId)
  }
}
