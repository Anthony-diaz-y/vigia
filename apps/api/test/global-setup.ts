import { Client } from 'pg'

import { resolveTestDatabase } from './database-url'

// Ejecuta una consulta en la base de mantenimiento del servidor
async function onMaintenance(url: string, statement: string): Promise<void> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(statement)
  } finally {
    await client.end()
  }
}

// Crea la base temporal de las pruebas e2e y la borra al terminar; sin VIGIA_DB_TESTS no hace nada
export async function setup(): Promise<(() => Promise<void>) | undefined> {
  if (process.env.VIGIA_DB_TESTS !== '1') {
    return undefined
  }
  const database = resolveTestDatabase()
  if (!database) {
    throw new Error('set VIGIA_DATABASE_URL in .env (or VIGIA_TEST_DATABASE_URL) to run test:db')
  }
  // El nombre ya está validado (solo [a-z0-9_] y sufijo _test), por eso se puede interpolar
  const drop = `DROP DATABASE IF EXISTS "${database.name}" WITH (FORCE)`
  await onMaintenance(database.maintenanceUrl, drop)
  await onMaintenance(database.maintenanceUrl, `CREATE DATABASE "${database.name}"`)
  return () => onMaintenance(database.maintenanceUrl, drop)
}
