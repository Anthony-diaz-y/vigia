import { Module } from '@nestjs/common'

import { AccessTokenGuard } from './guards/access-token.guard'

@Module({
  providers: [AccessTokenGuard],
  exports: [AccessTokenGuard],
})
export class CommonModule {}
