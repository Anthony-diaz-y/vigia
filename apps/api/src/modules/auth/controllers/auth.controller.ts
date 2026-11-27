import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { LoginRequestSchema, type LoginResponse, type SessionUser } from '@vigia/contracts'
import type { Request } from 'express'

import { AuthGuard } from '../../../common/auth/auth.guard'
import { CurrentUser } from '../../../common/auth/current-user.decorator'
import { parseBody } from '../../../common/utils/body'
import { AuthService } from '../services/auth.service'

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  // Inicia sesión con correo y contraseña
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown, @Req() request: Request): Promise<LoginResponse> {
    return this.auth.login(parseBody(LoginRequestSchema, body), request.ip ?? 'unknown')
  }

  // Devuelve el usuario de la sesión actual
  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user
  }
}
