import { timingSafeEqual } from 'node:crypto'

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'

import { APP_CONFIG, type AppConfig } from '../config/app-config'

// Compara dos cadenas en tiempo constante para evitar ataques de temporización
function safeEqual(provided: string, expected: string): boolean {
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

// Obtiene el token de la cabecera X-Access-Token o de Authorization Bearer
function extractToken(request: Request): string | undefined {
  const header = request.headers['x-access-token']
  if (typeof header === 'string' && header.length > 0) {
    return header
  }
  const authorization = request.headers.authorization
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length)
  }
  return undefined
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  // Deja pasar la petición solo si trae el token de acceso correcto
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const token = extractToken(request)
    if (!token || !safeEqual(token, this.config.accessToken)) {
      throw new UnauthorizedException('token de acceso inválido o ausente')
    }
    return true
  }
}
