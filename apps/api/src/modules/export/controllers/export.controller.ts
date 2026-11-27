import { Controller, Get, Inject, Query, Res, StreamableFile, UseGuards } from '@nestjs/common'
import type { Response } from 'express'

import { AuthGuard } from '../../../common/auth/auth.guard'
import { parseOptionalInteger } from '../../../common/utils/query'
import { ExportService } from '../services/export.service'

@Controller('export')
@UseGuards(AuthGuard)
export class ExportController {
  constructor(@Inject(ExportService) private readonly exports: ExportService) {}

  // Descarga los casos como archivo CSV o Parquet
  @Get()
  async export(
    @Query('format') format = 'csv',
    @Query('upload_id') uploadId: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.exports.export(format, parseOptionalInteger(uploadId, 'upload_id'))
    response.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename=${file.filename}`,
    })
    return new StreamableFile(file.buffer)
  }
}
