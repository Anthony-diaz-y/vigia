import { Controller, Get, Inject, Query, Res, StreamableFile, UseGuards } from '@nestjs/common'
import type { Response } from 'express'

import { parseOptionalInteger } from '../../../shared/http/query'
import { AccessTokenGuard } from '../../identity/interface/access-token.guard'
import { ExportService } from '../application/export.service'

@Controller('export')
@UseGuards(AccessTokenGuard)
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
