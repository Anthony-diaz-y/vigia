import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { SessionUser } from '@vigia/contracts'

import type { AuthenticatedRequest } from './auth.guard'

// Entrega al controlador el usuario de la sesión que dejó AuthGuard
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user
    if (!user) {
      throw new Error('CurrentUser requires AuthGuard')
    }
    return user
  },
)
