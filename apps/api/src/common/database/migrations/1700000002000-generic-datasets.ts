import type { MigrationInterface, QueryRunner } from 'typeorm'

export class GenericDatasets1700000002000 implements MigrationInterface {
  name = 'GenericDatasets1700000002000'

  // Agrega título, tema, columnas y capa epidemiológica a las cargas, y la tabla de filas genéricas
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "uploads"
       ADD COLUMN IF NOT EXISTS "title" text NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS "topic" text NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS "columns" jsonb NOT NULL DEFAULT '[]'::jsonb,
       ADD COLUMN IF NOT EXISTS "epi" boolean NOT NULL DEFAULT true`,
    )
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "dataset_rows" (
        "upload_id" integer NOT NULL REFERENCES "uploads" ("id") ON DELETE CASCADE,
        "row_number" integer NOT NULL,
        "data" jsonb NOT NULL,
        CONSTRAINT "pk_dataset_rows" PRIMARY KEY ("upload_id", "row_number")
      )`,
    )
  }

  // Elimina la tabla de filas genéricas y las columnas agregadas a las cargas
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "dataset_rows"')
    await queryRunner.query(
      `ALTER TABLE "uploads"
       DROP COLUMN IF EXISTS "epi",
       DROP COLUMN IF EXISTS "columns",
       DROP COLUMN IF EXISTS "topic",
       DROP COLUMN IF EXISTS "title"`,
    )
  }
}
