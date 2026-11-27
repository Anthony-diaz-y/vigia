import {
  Controller,
  Get,
  Inject,
  Query,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'

import { AuthGuard } from '../../../common/auth/auth.guard'
import { parseOptionalInteger } from '../../../common/utils/query'
import { ExportService } from '../services/export.service'

const EXPORT_FORMATS = ['csv', 'parquet'] as const

@Controller('export')
@UseGuards(AuthGuard)
export class ExportController {
  constructor(@Inject(ExportService) private readonly exports: ExportService) {}

  // Descarga los casos en CSV o Parquet; envía el buffer directo porque StreamableFile falla con tsx
  @Get()
  async export(
    @Query('format') format = 'csv',
    @Query('upload_id') uploadId: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!(EXPORT_FORMATS as readonly string[]).includes(format)) {
      throw new UnprocessableEntityException(
        `format must be one of ('csv', 'parquet'), got '${format}'`,
      )
    }
    const file = await this.exports.export(format, parseOptionalInteger(uploadId, 'upload_id'))
    response
      .set({
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename=${file.filename}`,
      })
      .send(file.buffer)
  }
}
