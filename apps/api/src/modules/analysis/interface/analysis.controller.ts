import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common'
import type {
  AnomalyRow,
  GeoLevel,
  HeatmapResponse,
  InterannualRow,
  RankingRow,
  WeeklySeriesRow,
} from '@vigia/contracts'

import { AccessTokenGuard } from '../../identity/interface/access-token.guard'
import { AnalysisService } from '../application/analysis.service'

@Controller('analysis')
@UseGuards(AccessTokenGuard)
export class AnalysisController {
  constructor(@Inject(AnalysisService) private readonly analysis: AnalysisService) {}

  @Get('series')
  series(
    @Query('level') level = 'department',
    @Query('upload_id') uploadId?: string,
  ): Promise<WeeklySeriesRow[]> {
    return this.analysis.series(parseLevel(level), parseUploadId(uploadId))
  }

  @Get('interannual')
  interannual(
    @Query('level') level = 'department',
    @Query('geography') geography?: string,
    @Query('upload_id') uploadId?: string,
  ): Promise<InterannualRow[]> {
    return this.analysis.interannual(parseLevel(level), geography, parseUploadId(uploadId))
  }

  @Get('heatmap')
  heatmap(
    @Query('year') year: string | undefined,
    @Query('level') level = 'department',
    @Query('upload_id') uploadId?: string,
  ): Promise<HeatmapResponse> {
    return this.analysis.heatmap(
      parseLevel(level),
      parseInteger(year, 'year'),
      parseUploadId(uploadId),
    )
  }

  @Get('ranking')
  ranking(
    @Query('level') level = 'department',
    @Query('year') year?: string,
    @Query('upload_id') uploadId?: string,
  ): Promise<RankingRow[]> {
    return this.analysis.ranking(
      parseLevel(level),
      parseOptionalInteger(year, 'year'),
      parseUploadId(uploadId),
    )
  }

  @Get('anomalies')
  anomalies(
    @Query('level') level = 'department',
    @Query('upload_id') uploadId?: string,
  ): Promise<AnomalyRow[]> {
    return this.analysis.anomalies(parseLevel(level), parseUploadId(uploadId))
  }
}

function parseLevel(value: string): GeoLevel {
  if (value === 'department' || value === 'province') {
    return value
  }
  throw new BadRequestException(`level must be one of ('department', 'province'), got '${value}'`)
}

function parseUploadId(value: string | undefined): number | undefined {
  return parseOptionalInteger(value, 'upload_id')
}

function parseOptionalInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!/^-?\d+$/.test(value)) {
    throw new UnprocessableEntityException(`${name} must be an integer`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new UnprocessableEntityException(`${name} must be an integer`)
  }
  return parsed
}

function parseInteger(value: string | undefined, name: string): number {
  const parsed = parseOptionalInteger(value, name)
  if (parsed === undefined) {
    throw new UnprocessableEntityException(`${name} is required`)
  }
  return parsed
}
