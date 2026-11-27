import type { DataSource } from 'typeorm'

import { signSession } from '../src/common/auth/session-token'
import { loadConfig } from '../src/common/config/app-config'

// Cabecera Authorization del administrador inicial, que la app crea al arrancar
export async function adminBearer(dataSource: DataSource): Promise<string> {
  const config = loadConfig()
  const rows = await dataSource.query<{ id: number }[]>('SELECT id FROM users WHERE email = $1', [
    config.auth.admin.email,
  ])
  const id = rows[0]?.id
  if (id === undefined) {
    throw new Error('the initial administrator was not created')
  }
  const { token } = signSession({ sub: id, role: 'admin' }, config.auth.secret, 3600)
  return `Bearer ${token}`
}
