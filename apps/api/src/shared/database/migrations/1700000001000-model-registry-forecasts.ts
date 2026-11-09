import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Forecast quantiles leave Parquet behind: the model registry keeps the
 * published rows as JSONB next to the config, data cut and scorecard.
 */
export class ModelRegistryForecasts1700000001000 implements MigrationInterface {
  name = 'ModelRegistryForecasts1700000001000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "model_registry" DROP COLUMN IF EXISTS "forecasts_storage_key"',
    )
    await queryRunner.query(
      `ALTER TABLE "model_registry"
       ADD COLUMN IF NOT EXISTS "forecasts" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "model_registry" DROP COLUMN IF EXISTS "forecasts"')
    await queryRunner.query(
      'ALTER TABLE "model_registry" ADD COLUMN IF NOT EXISTS "forecasts_storage_key" text',
    )
  }
}
