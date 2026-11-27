import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  UnprocessableEntityException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { CreateUserRequest, SessionUser, UserDto } from '@vigia/contracts'
import { QueryFailedError, Repository } from 'typeorm'

import { hashPassword } from '../../../common/auth/password'
import { APP_CONFIG, type AppConfig } from '../../../common/config/app-config'
import { UserEntity } from '../entities/user.entity'

const DUPLICATE_EMAIL = 'Ya existe un usuario con ese correo.'
const UNIQUE_VIOLATION = '23505'

// Indica si PostgreSQL rechazó la escritura por una clave única repetida
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: unknown } | undefined)?.code === UNIQUE_VIOLATION
  )
}

// Convierte la entidad en el usuario que ve la API, sin el hash de la contraseña
export function toUserDto(user: UserEntity): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    created_at: user.createdAt.toISOString(),
  }
}

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  // Crea el primer administrador desde la configuración si todavía no hay usuarios
  async onApplicationBootstrap(): Promise<void> {
    if ((await this.users.count()) > 0) {
      return
    }
    const { email, name, password } = this.config.auth.admin
    await this.create({ email, name, password, role: 'admin' })
    this.logger.log(`Administrador inicial creado: ${email}`)
  }

  // Lista los usuarios, primero los más antiguos
  async list(): Promise<UserDto[]> {
    const users = await this.users.find({ order: { createdAt: 'ASC', id: 'ASC' } })
    return users.map(toUserDto)
  }

  // Crea un usuario con la contraseña cifrada; el correo no se puede repetir
  async create(request: CreateUserRequest): Promise<UserDto> {
    const email = request.email.trim().toLowerCase()
    if (await this.users.existsBy({ email })) {
      throw new ConflictException(DUPLICATE_EMAIL)
    }
    const entity = this.users.create({
      email,
      name: request.name.trim(),
      role: request.role,
      passwordHash: await hashPassword(request.password),
    })
    try {
      return toUserDto(await this.users.save(entity))
    } catch (error) {
      // Otra petición simultánea creó el mismo correo entre la comprobación y el guardado
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_EMAIL)
      }
      throw error
    }
  }

  // Elimina un usuario, salvo a uno mismo o al último administrador
  async remove(id: number, actor: SessionUser): Promise<void> {
    if (id === actor.id) {
      throw new UnprocessableEntityException('No puedes eliminar tu propio usuario.')
    }
    // Bloquea las filas de administradores para que dos borrados simultáneos no dejen ninguno
    await this.users.manager.transaction(async (manager) => {
      const repository = manager.getRepository(UserEntity)
      const admins = await repository.find({
        where: { role: 'admin' },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      })
      const user = await repository.findOneBy({ id })
      if (!user) {
        throw new NotFoundException('El usuario no existe.')
      }
      if (user.role === 'admin' && admins.length <= 1) {
        throw new UnprocessableEntityException('Debe quedar al menos un administrador.')
      }
      await repository.delete({ id })
    })
  }
}
