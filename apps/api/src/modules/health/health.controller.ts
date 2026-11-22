import { Controller, Get } from '@nestjs/common'
import { DISCLAIMER, type HealthDto } from '@vigia/contracts'

@Controller('health')
export class HealthController {
  // Indica que la API está viva junto con el aviso legal
  @Get()
  health(): HealthDto {
    return { status: 'ok', disclaimer: DISCLAIMER }
  }
}
