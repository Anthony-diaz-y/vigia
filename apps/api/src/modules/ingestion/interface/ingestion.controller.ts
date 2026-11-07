import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { UploadDto } from '@vigia/contracts'
import { CANONICAL_COLUMNS } from '@vigia/epidemiology'

import { AccessTokenGuard } from '../../identity/interface/access-token.guard'
import { IngestError } from '../domain/errors'
import { IngestionService } from '../application/ingestion.service'
import type { PreviewResult } from '../application/ingest'

const UPLOAD_LIMIT = 55 * 1024 * 1024

@Controller()
@UseGuards(AccessTokenGuard)
export class IngestionController {
  constructor(@Inject(IngestionService) private readonly ingestion: IngestionService) {}

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_LIMIT } }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('source') source = 'minsa_dengue',
    @Body('mapping') mapping?: string,
  ): Promise<UploadDto> {
    if (!file) {
      throw new UnprocessableEntityException('file is required')
    }
    try {
      return await this.ingestion.ingest(
        file.buffer,
        file.originalname || 'upload.csv',
        source,
        parseMapping(mapping),
      )
    } catch (error) {
      throw asUnprocessable(error)
    }
  }

  @Post('upload/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_LIMIT } }))
  async preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('source') source = 'minsa_dengue',
  ): Promise<PreviewResult> {
    if (!file) {
      throw new UnprocessableEntityException('file is required')
    }
    try {
      return await this.ingestion.preview(file.buffer, file.originalname || 'upload.csv', source)
    } catch (error) {
      throw asUnprocessable(error)
    }
  }
}

function parseMapping(mapping: string | undefined): Record<string, string> | undefined {
  if (!mapping) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(mapping)
  } catch {
    throw new UnprocessableEntityException('invalid mapping JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new UnprocessableEntityException('invalid mapping JSON')
  }
  const result: Record<string, string> = {}
  const allowed = new Set<string>(CANONICAL_COLUMNS)
  for (const [canonical, source] of Object.entries(parsed)) {
    if (!allowed.has(canonical)) {
      continue
    }
    if (typeof source !== 'string') {
      throw new UnprocessableEntityException('invalid mapping JSON')
    }
    result[canonical] = source
  }
  return result
}

function asUnprocessable(error: unknown): unknown {
  return error instanceof IngestError ? new UnprocessableEntityException(error.message) : error
}
