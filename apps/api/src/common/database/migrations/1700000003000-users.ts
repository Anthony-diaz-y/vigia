import type { MigrationInterface, QueryRunner } from 'typeorm'

export class Users1700000003000 implements MigrationInterface {
  name = 'Users1700000003000'

  // Crea la tabla de usuarios que inician sesión en Vigia
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "email" varchar(254) NOT NULL UNIQUE,
        "name" varchar(80) NOT NULL,
        "password_hash" text NOT NULL,
        "role" varchar(16) NOT NULL CHECK ("role" IN ('admin', 'analyst')),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`,
    )
  }

  // Elimina la tabla de usuarios
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "users"')
  }
}
