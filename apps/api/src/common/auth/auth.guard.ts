import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { SessionUser } from '@vigia/contracts'
import type { Request } from 'express'
import { Repository } from 'typeorm'

import { UserEntity } from '../../modules/users/entities/user.entity'
import { APP_CONFIG, type AppConfig } from '../config/app-config'
import { verifySession } from './session-token'

export type AuthenticatedRequest = Request & { user?: SessionUser }

// Obtiene la sesión de la cabecera Authorization: Bearer
function bearerToken(request: Request): string | null {
  const authorization = request.headers.authorization
  return typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  // Deja pasar solo sesiones firmadas, vigentes y de usuarios que todavía existen
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = bearerToken(request)
    const claims = token ? verifySession(token, this.config.auth.secret) : null
    const user = claims ? await this.users.findOneBy({ id: claims.sub }) : null
    if (!user) {
      throw new UnauthorizedException('Tu sesión venció o no es válida. Vuelve a iniciar sesión.')
    }
    request.user = { id: user.id, email: user.email, name: user.name, role: user.role }
    return true
  }
}
