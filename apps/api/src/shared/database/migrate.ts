import { loadConfig, loadEnvFiles } from '../config/app-config'
import { createDataSource } from './data-source'

async function main(): Promise<void> {
  loadEnvFiles()
  const dataSource = createDataSource(loadConfig())
  await dataSource.initialize()
  try {
    const applied = await dataSource.runMigrations({ transaction: 'all' })
    if (applied.length === 0) {
      console.log('database is up to date')
      return
    }
    for (const migration of applied) {
      console.log(`applied ${migration.name}`)
    }
  } finally {
    await dataSource.destroy()
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
