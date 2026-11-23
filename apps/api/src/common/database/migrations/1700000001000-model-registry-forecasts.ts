import type { MigrationInterface, QueryRunner } from 'typeorm'

export class ModelRegistryForecasts1700000001000 implements MigrationInterface {
  name = 'ModelRegistryForecasts1700000001000'

  // Reemplaza la clave de almacenamiento de pronósticos por una columna JSONB forecasts
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "model_registry" DROP COLUMN IF EXISTS "forecasts_storage_key"',
    )
    await queryRunner.query(
      `ALTER TABLE "model_registry"
       ADD COLUMN IF NOT EXISTS "forecasts" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    )
  }

  // Restaura la columna forecasts_storage_key y elimina forecasts
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "model_registry" DROP COLUMN IF EXISTS "forecasts"')
    await queryRunner.query(
      'ALTER TABLE "model_registry" ADD COLUMN IF NOT EXISTS "forecasts_storage_key" text',
    )
  }
}
