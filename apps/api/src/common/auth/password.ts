import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64
const COST = 16_384

// Deriva la clave scrypt de una contraseña con la sal dada
function derive(password: string, salt: Buffer, cost: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: cost }, (error, key) => {
      if (error) {
        reject(error)
        return
      }
      resolve(key)
    })
  })
}

// Convierte una contraseña en un hash scrypt con sal aleatoria, listo para guardar
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, COST)
  return ['scrypt', COST, salt.toString('base64url'), key.toString('base64url')].join('$')
}

// Comprueba en tiempo constante si la contraseña coincide con el hash guardado
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !cost || !salt || !hash) {
    return false
  }
  const expected = Buffer.from(hash, 'base64url')
  const key = await derive(password, Buffer.from(salt, 'base64url'), Number(cost))
  return key.length === expected.length && timingSafeEqual(key, expected)
}
