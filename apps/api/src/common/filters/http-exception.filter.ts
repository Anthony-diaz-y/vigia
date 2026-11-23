import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'

// Obtiene el mensaje de error legible de una excepción HTTP
function extractDetail(exception: HttpException): string {
  const body = exception.getResponse()
  if (typeof body === 'string') {
    return body
  }
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = (body as { message: unknown }).message
    if (Array.isArray(message)) {
      return message.map(String).join('; ')
    }
    if (typeof message === 'string') {
      return message
    }
  }
  return exception.message
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  // Responde cualquier error con el formato { detail } y registra los no controlados
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json({ detail: extractDetail(exception) })
      return
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : exception,
    )
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ detail: 'error interno' })
  }
}
