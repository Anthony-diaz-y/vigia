const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000

// Cuenta intentos fallidos de inicio de sesión por clave y bloquea tras varios seguidos
export class LoginThrottle {
  private readonly failures = new Map<string, { count: number; since: number }>()

  constructor(
    private readonly maxFailures: number = MAX_FAILURES,
    private readonly windowMs: number = WINDOW_MS,
  ) {}

  // Indica si la clave agotó sus intentos dentro de la ventana actual
  blocked(key: string, now: number = Date.now()): boolean {
    const entry = this.failures.get(key)
    if (!entry) {
      return false
    }
    if (now - entry.since > this.windowMs) {
      this.failures.delete(key)
      return false
    }
    return entry.count >= this.maxFailures
  }

  // Registra un intento fallido
  fail(key: string, now: number = Date.now()): void {
    const entry = this.failures.get(key)
    if (!entry || now - entry.since > this.windowMs) {
      this.failures.set(key, { count: 1, since: now })
      return
    }
    entry.count += 1
  }

  // Olvida los fallos tras un inicio de sesión correcto
  reset(key: string): void {
    this.failures.delete(key)
  }
}
