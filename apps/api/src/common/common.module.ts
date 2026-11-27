import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { UserEntity } from '../modules/users/entities/user.entity'
import { AdminGuard } from './auth/admin.guard'
import { AuthGuard } from './auth/auth.guard'

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [AuthGuard, AdminGuard],
  exports: [AuthGuard, AdminGuard, TypeOrmModule],
})
export class CommonModule {}
