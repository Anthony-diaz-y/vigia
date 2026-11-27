import type { ArgumentsHost } from '@nestjs/common'
import { NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { HttpExceptionFilter } from './http-exception.filter'

// Arma un host HTTP falso que captura el código y el cuerpo de la respuesta
function fakeHost(): {
  host: ArgumentsHost
  status: ReturnType<typeof vi.fn>
  json: ReturnType<typeof vi.fn>
} {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost
  return { host, status, json }
}

// Simula una HttpException de otra copia de @nestjs/common, como ocurre al correr con tsx
class ForeignHttpException extends Error {
  constructor(
    private readonly status: number,
    private readonly body: unknown,
  ) {
    super('foreign')
  }

  getStatus(): number {
    return this.status
  }

  getResponse(): unknown {
    return this.body
  }
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter()

  it('mantiene el código y el detalle de una excepción HTTP', () => {
    const { host, status, json } = fakeHost()
    filter.catch(new NotFoundException('carga no encontrada'), host)
    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({ detail: 'carga no encontrada' })
  })

  it('responde 400 a un JSON mal formado aunque la excepción venga de otra copia de Nest', () => {
    const { host, status, json } = fakeHost()
    const body = { message: 'Expected property name', statusCode: 400 }
    filter.catch(new ForeignHttpException(400, body), host)
    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ detail: 'Expected property name' })
  })

  it('responde 413 a un cuerpo demasiado grande aunque venga de otra copia de Nest', () => {
    const { host, status, json } = fakeHost()
    filter.catch(new ForeignHttpException(413, 'request entity too large'), host)
    expect(status).toHaveBeenCalledWith(413)
    expect(json).toHaveBeenCalledWith({ detail: 'request entity too large' })
  })

  it('responde 500 sin filtrar detalles a cualquier otro error', () => {
    const { host, status, json } = fakeHost()
    filter.catch(new Error('secreto interno'), host)
    filter.catch(
      Object.assign(new Error('fallo'), { getStatus: () => 'x', getResponse: () => 'y' }),
      host,
    )
    expect(status).toHaveBeenNthCalledWith(1, 500)
    expect(status).toHaveBeenNthCalledWith(2, 500)
    expect(json).toHaveBeenCalledWith({ detail: 'error interno' })
    expect(json).not.toHaveBeenCalledWith({ detail: 'secreto interno' })
  })
})
