import { createHash } from 'node:crypto'

import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config/app-config'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-chat'
const TIMEOUT_MS = 25_000
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 200

export interface ChatRequest {
  system: string
  user: string
  json?: boolean
}

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: unknown } }>
}

@Injectable()
export class DeepSeekClient {
  private readonly logger = new Logger(DeepSeekClient.name)
  private readonly cache = new Map<string, { text: string; expires: number }>()

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  // Indica si hay clave de DeepSeek configurada
  get enabled(): boolean {
    return Boolean(this.config.deepseekApiKey)
  }

  // Pide una respuesta a DeepSeek con caché; devuelve null si falla para usar la plantilla
  async complete(request: ChatRequest): Promise<string | null> {
    const key = this.config.deepseekApiKey
    if (!key) {
      return null
    }

    const cacheKey = createHash('sha256').update(JSON.stringify(request)).digest('hex')
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expires > Date.now()) {
      return cached.text
    }

    try {
      const response = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          temperature: 0,
          ...(request.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) {
        throw new Error(`DeepSeek responded with ${response.status}`)
      }
      const data = (await response.json()) as DeepSeekResponse
      const text = data.choices?.[0]?.message?.content
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('DeepSeek returned an empty answer')
      }
      this.remember(cacheKey, text)
      return text
    } catch (error: unknown) {
      this.logger.warn(
        `narrative fallback: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }

  // Guarda la respuesta en caché descartando la más antigua si está llena
  private remember(key: string, text: string): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) {
        this.cache.delete(oldest)
      }
    }
    this.cache.set(key, { text, expires: Date.now() + CACHE_TTL_MS })
  }
}

@Global()
@Module({
  providers: [DeepSeekClient],
  exports: [DeepSeekClient],
})
export class LlmModule {}
