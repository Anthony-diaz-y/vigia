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
import { Repository } from 'typeorm'

import { hashPassword } from '../../../common/auth/password'
import { APP_CONFIG, type AppConfig } from '../../../common/config/app-config'
import { UserEntity } from '../entities/user.entity'

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
      throw new ConflictException('Ya existe un usuario con ese correo.')
    }
    const user = await this.users.save(
      this.users.create({
        email,
        name: request.name.trim(),
        role: request.role,
        passwordHash: await hashPassword(request.password),
      }),
    )
    return toUserDto(user)
  }

  // Elimina un usuario, salvo a uno mismo o al último administrador
  async remove(id: number, actor: SessionUser): Promise<void> {
    if (id === actor.id) {
      throw new UnprocessableEntityException('No puedes eliminar tu propio usuario.')
    }
    const user = await this.users.findOneBy({ id })
    if (!user) {
      throw new NotFoundException('El usuario no existe.')
    }
    if (user.role === 'admin' && (await this.users.countBy({ role: 'admin' })) <= 1) {
      throw new UnprocessableEntityException('Debe quedar al menos un administrador.')
    }
    await this.users.delete({ id })
  }
}
