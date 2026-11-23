import { Global, Module } from '@nestjs/common'

import { DeepSeekClient } from './deepseek.client'

@Global()
@Module({
  providers: [DeepSeekClient],
  exports: [DeepSeekClient],
})
export class LlmModule {}
