import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

import type { AuthenticatedRequest } from './auth.guard'

@Injectable()
export class AdminGuard implements CanActivate {
  // Deja pasar solo a administradores; va siempre después de AuthGuard
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Solo un administrador puede hacer esto.')
    }
    return true
  }
}
