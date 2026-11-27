import { describe, expect, it, vi } from 'vitest'

import type { AppConfig } from '../../../common/config/app-config'
import { UsersService } from './users.service'

// Servicio con un repositorio falso que solo cuenta usuarios y guarda lo creado
function service(count: number, password: string | undefined) {
  const save = vi.fn(async (user: object) => ({ ...user, id: 1, createdAt: new Date(0) }))
  const repository = {
    count: vi.fn(async () => count),
    existsBy: vi.fn(async () => false),
    create: vi.fn((user: object) => user),
    save,
  }
  const config = {
    auth: { admin: { email: 'admin@vigia.local', name: 'Administrador', password } },
  } as unknown as AppConfig
  return { users: new UsersService(config, repository as never), save }
}

describe('UsersService.onApplicationBootstrap', () => {
  it('se niega a crear el primer administrador sin VIGIA_ADMIN_PASSWORD', async () => {
    const { users, save } = service(0, undefined)
    await expect(users.onApplicationBootstrap()).rejects.toThrow(
      'set VIGIA_ADMIN_PASSWORD in .env to create the first administrator',
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('crea el primer administrador con la contraseña configurada', async () => {
    const { users, save } = service(0, 'una-clave-segura')
    await users.onApplicationBootstrap()
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@vigia.local', role: 'admin' }),
    )
  })

  it('no exige la contraseña cuando ya hay usuarios', async () => {
    const { users, save } = service(3, undefined)
    await expect(users.onApplicationBootstrap()).resolves.toBeUndefined()
    expect(save).not.toHaveBeenCalled()
  })
})
