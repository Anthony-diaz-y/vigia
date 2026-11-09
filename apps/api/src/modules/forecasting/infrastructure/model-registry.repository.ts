import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

export interface RegistryEntry {
  modelId: string
  level: string
  config: object
  dataCut: object
  scorecard: unknown[]
  forecasts: unknown[]
}

@Injectable()
export class ModelRegistryRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Idempotent by `model_id`: the same config and data cut always resolve to the
   * same versioned row, matching the Python registry directory semantics.
   */
  async save(entry: RegistryEntry): Promise<void> {
    await this.dataSource.query(
      `
      INSERT INTO "model_registry"
        ("model_id", "level", "config", "data_cut", "scorecard", "forecasts")
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
      ON CONFLICT ("model_id") DO UPDATE SET
        "level" = EXCLUDED."level",
        "config" = EXCLUDED."config",
        "data_cut" = EXCLUDED."data_cut",
        "scorecard" = EXCLUDED."scorecard",
        "forecasts" = EXCLUDED."forecasts"
      `,
      [
        entry.modelId,
        entry.level,
        JSON.stringify(entry.config),
        JSON.stringify(entry.dataCut),
        JSON.stringify(entry.scorecard),
        JSON.stringify(entry.forecasts),
      ],
    )
  }
}
