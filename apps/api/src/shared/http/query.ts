import { BadRequestException, UnprocessableEntityException } from '@nestjs/common'
import type { GeoLevel } from '@vigia/contracts'

export function parseLevel(value: string): GeoLevel {
  if (value === 'department' || value === 'province') {
    return value
  }
  throw new BadRequestException(`level must be one of ('department', 'province'), got '${value}'`)
}

export function parseOptionalInteger(value: string | undefined, name: string): number | undefined {
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

export function parseInteger(value: string | undefined, name: string): number {
  const parsed = parseOptionalInteger(value, name)
  if (parsed === undefined) {
    throw new UnprocessableEntityException(`${name} is required`)
  }
  return parsed
}
