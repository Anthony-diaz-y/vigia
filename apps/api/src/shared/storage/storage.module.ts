import { Module } from '@nestjs/common'

import { LocalStorageAdapter } from './local-storage.adapter'
import { STORAGE } from './storage.port'

@Module({
  providers: [{ provide: STORAGE, useClass: LocalStorageAdapter }],
  exports: [STORAGE],
})
export class StorageModule {}
