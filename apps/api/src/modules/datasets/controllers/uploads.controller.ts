import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common'
import type { ClearUploadsResponse, QualityReportDto, UploadDto } from '@vigia/contracts'

import { AdminGuard } from '../../../common/auth/admin.guard'
import { AuthGuard } from '../../../common/auth/auth.guard'
import { DatasetsService } from '../services/datasets.service'

@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(@Inject(DatasetsService) private readonly datasets: DatasetsService) {}

  // Lista las cargas registradas
  @Get()
  list(): Promise<UploadDto[]> {
    return this.datasets.list()
  }

  // Devuelve el reporte de calidad de una carga
  @Get(':id/quality')
  quality(
    @Param('id', new ParseIntPipe({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }))
    id: number,
  ): Promise<QualityReportDto> {
    return this.datasets.quality(id)
  }

  // Elimina todas las cargas y sus archivos; solo administradores
  @Delete()
  @UseGuards(AdminGuard)
  clear(): Promise<ClearUploadsResponse> {
    return this.datasets.clear()
  }
}
