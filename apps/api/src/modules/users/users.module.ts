import { Module } from '@nestjs/common'

import { CommonModule } from '../../common/common.module'
import { UsersController } from './controllers/users.controller'
import { UsersService } from './services/users.service'

@Module({
  imports: [CommonModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
