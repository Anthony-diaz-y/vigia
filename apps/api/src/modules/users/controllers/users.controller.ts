import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common'
import { CreateUserRequestSchema, type SessionUser, type UserDto } from '@vigia/contracts'

import { AdminGuard } from '../../../common/auth/admin.guard'
import { AuthGuard } from '../../../common/auth/auth.guard'
import { CurrentUser } from '../../../common/auth/current-user.decorator'
import { parseBody } from '../../../common/utils/body'
import { UsersService } from '../services/users.service'

@Controller('users')
@UseGuards(AuthGuard, AdminGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  // Lista los usuarios de Vigia
  @Get()
  list(): Promise<UserDto[]> {
    return this.users.list()
  }

  // Crea un usuario nuevo
  @Post()
  create(@Body() body: unknown): Promise<UserDto> {
    return this.users.create(parseBody(CreateUserRequestSchema, body))
  }

  // Elimina un usuario
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', new ParseIntPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
    id: number,
    @CurrentUser() actor: SessionUser,
  ): Promise<void> {
    return this.users.remove(id, actor)
  }
}
