import { type ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import type { AppConfig } from '../../../shared/config/app-config'
import { AccessTokenGuard } from './access-token.guard'

function context(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext
}

function guard(): AccessTokenGuard {
  return new AccessTokenGuard({ accessToken: 'test-token' } as AppConfig)
}

describe('AccessTokenGuard', () => {
  it('accepts the X-Access-Token header', () => {
    expect(guard().canActivate(context({ 'x-access-token': 'test-token' }))).toBe(true)
  })

  it('accepts a Bearer token', () => {
    expect(guard().canActivate(context({ authorization: 'Bearer test-token' }))).toBe(true)
  })

  it('rejects a missing token', () => {
    expect(() => guard().canActivate(context({}))).toThrow(UnauthorizedException)
  })

  it('rejects a wrong token', () => {
    expect(() => guard().canActivate(context({ 'x-access-token': 'wrong-token' }))).toThrow(
      UnauthorizedException,
    )
  })

  it('rejects a malformed Authorization header', () => {
    expect(() => guard().canActivate(context({ authorization: 'Basic test-token' }))).toThrow(
      UnauthorizedException,
    )
  })
})
