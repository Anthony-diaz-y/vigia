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
import { DatasetColumnSchema, type UploadDto, type UploadPreview } from '@vigia/contracts'
import { isMappingTarget, type DatasetColumn } from '@vigia/epidemiology'
import { z } from 'zod'

import { AuthGuard } from '../../../common/auth/auth.guard'
import { IngestError } from '../lib/errors'
import { decodeFilename } from '../lib/filename'
import { IngestionService } from '../services/ingestion.service'

const UPLOAD_LIMIT = 55 * 1024 * 1024

@Controller()
@UseGuards(AuthGuard)
export class IngestionController {
  constructor(@Inject(IngestionService) private readonly ingestion: IngestionService) {}

  // Recibe un archivo y lo ingiere con la fuente y el mapeo opcional indicados
  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_LIMIT } }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('source') source = 'minsa_dengue',
    @Body('mapping') mapping?: string,
    @Body('columns') columns?: string,
    @Body('title') title?: string,
    @Body('topic') topic?: string,
  ): Promise<UploadDto> {
    if (!file) {
      throw new UnprocessableEntityException('file is required')
    }
    try {
      return await this.ingestion.ingest(file.buffer, fileName(file), source, {
        mappingOverride: parseMapping(mapping),
        columns: parseColumns(columns),
        title,
        topic,
      })
    } catch (error) {
      throw asUnprocessable(error)
    }
  }

  // Devuelve la vista previa del mapeo de columnas de un archivo
  @Post('upload/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_LIMIT } }))
  async preview(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('source') source = 'minsa_dengue',
  ): Promise<UploadPreview> {
    if (!file) {
      throw new UnprocessableEntityException('file is required')
    }
    try {
      return await this.ingestion.preview(file.buffer, fileName(file), source)
    } catch (error) {
      throw asUnprocessable(error)
    }
  }
}

// Parsea el JSON del mapeo manual y conserva solo campos conocidos
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
  for (const [canonical, source] of Object.entries(parsed)) {
    if (!isMappingTarget(canonical)) {
      continue
    }
    if (typeof source !== 'string') {
      throw new UnprocessableEntityException('invalid mapping JSON')
    }
    result[canonical] = source
  }
  return result
}

// Parsea y valida el JSON de columnas confirmadas en el modal de revisión
function parseColumns(columns: string | undefined): DatasetColumn[] | undefined {
  if (!columns) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(columns)
  } catch {
    throw new UnprocessableEntityException('invalid columns JSON')
  }
  const result = z.array(DatasetColumnSchema).safeParse(withoutPreviewCodes(parsed))
  if (!result.success) {
    throw new UnprocessableEntityException('invalid columns JSON')
  }
  return result.data
}

// Quita la lista de códigos de la vista previa si el cliente la reenvía junto con las columnas
function withoutPreviewCodes(parsed: unknown): unknown {
  return Array.isArray(parsed)
    ? parsed.map((item: unknown) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          return item
        }
        const { codes: _codes, ...column } = item as Record<string, unknown>
        return column
      })
    : parsed
}

// Nombre legible del archivo subido, con sus tildes y eñes
function fileName(file: Express.Multer.File): string {
  return file.originalname ? decodeFilename(file.originalname) : 'upload.csv'
}

// Convierte errores de ingesta en respuestas HTTP 422
function asUnprocessable(error: unknown): unknown {
  return error instanceof IngestError ? new UnprocessableEntityException(error.message) : error
}
