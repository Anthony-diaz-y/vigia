import { Controller, Get } from '@nestjs/common'
import { DISCLAIMER, type HealthDto } from '@vigia/contracts'

@Controller('health')
export class HealthController {
  @Get()
  health(): HealthDto {
    return { status: 'ok', disclaimer: DISCLAIMER }
  }
}
