import { describe, expect, it } from 'vitest'

import { LoginThrottle } from './login-throttle'

describe('LoginThrottle', () => {
  it('bloquea tras el máximo de fallos y libera al pasar la ventana', () => {
    const throttle = new LoginThrottle(3, 1000)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(throttle.blocked('ana@x.pe', 0)).toBe(false)
      throttle.fail('ana@x.pe', 0)
    }
    expect(throttle.blocked('ana@x.pe', 500)).toBe(true)
    expect(throttle.blocked('otra@x.pe', 500)).toBe(false)
    expect(throttle.blocked('ana@x.pe', 1001)).toBe(false)
  })

  it('descarta las claves vencidas para no crecer sin límite', () => {
    const throttle = new LoginThrottle(5, 1000, 100)
    for (let index = 0; index < 100; index += 1) {
      throttle.fail(`viejo-${index}@x.pe`, 0)
    }
    throttle.fail('nuevo@x.pe', 5000)
    expect(throttle.size).toBe(1)
    expect(throttle.blocked('nuevo@x.pe', 5000)).toBe(false)
  })

  it('olvida los fallos tras un ingreso correcto', () => {
    const throttle = new LoginThrottle(2, 1000)
    throttle.fail('ana@x.pe', 0)
    throttle.fail('ana@x.pe', 0)
    throttle.reset('ana@x.pe')
    expect(throttle.blocked('ana@x.pe', 10)).toBe(false)
  })
})
