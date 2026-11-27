import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { LoginRequest, LoginResponse } from '@vigia/contracts'
import { Repository } from 'typeorm'

import { hashPassword, verifyPassword } from '../../../common/auth/password'
import { signSession } from '../../../common/auth/session-token'
import { APP_CONFIG, type AppConfig } from '../../../common/config/app-config'
import { UserEntity } from '../../users/entities/user.entity'
import { LoginThrottle } from '../lib/login-throttle'

const INVALID_LOGIN = 'Correo o contraseña incorrectos.'
const TOO_MANY = 'Demasiados intentos fallidos. Espera unos minutos y vuelve a intentarlo.'

@Injectable()
export class AuthService {
  private readonly throttle = new LoginThrottle()
  private decoy: Promise<string> | null = null

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  // Valida correo y contraseña y entrega una sesión firmada
  async login(request: LoginRequest, clientKey: string): Promise<LoginResponse> {
    const key = `${request.email}|${clientKey}`
    if (this.throttle.blocked(key)) {
      throw new HttpException(TOO_MANY, HttpStatus.TOO_MANY_REQUESTS)
    }
    const user = await this.users.findOneBy({ email: request.email })
    const stored = user?.passwordHash ?? (await this.decoyHash())
    const valid = await verifyPassword(request.password, stored)
    if (!user || !valid) {
      this.throttle.fail(key)
      throw new UnauthorizedException(INVALID_LOGIN)
    }
    this.throttle.reset(key)
    const { token, expiresAt } = signSession(
      { sub: user.id, role: user.role },
      this.config.auth.secret,
      this.config.auth.sessionSeconds,
    )
    return {
      token,
      expires_at: expiresAt.toISOString(),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }
  }

  // Hash de relleno para que un correo inexistente tarde lo mismo que uno real
  private decoyHash(): Promise<string> {
    this.decoy ??= hashPassword('vigia-decoy-password')
    return this.decoy
  }
}
