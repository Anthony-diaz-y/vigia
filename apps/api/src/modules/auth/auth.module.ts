import { Module } from '@nestjs/common'

import { CommonModule } from '../../common/common.module'
import { AuthController } from './controllers/auth.controller'
import { AuthService } from './services/auth.service'

@Module({
  imports: [CommonModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
