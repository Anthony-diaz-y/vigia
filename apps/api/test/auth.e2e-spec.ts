import type { Server } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { LoginResponseSchema, UserSchema } from '@vigia/contracts'
import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AppModule } from '../src/app.module'
import { loadConfig } from '../src/common/config/app-config'
import { createDataSource } from '../src/common/database/data-source'
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter'

const dbEnabled = process.env.VIGIA_DB_TESTS === '1'
const config = loadConfig()
const admin = config.auth.admin

describe.skipIf(!dbEnabled)('login and users against PostgreSQL', () => {
  let app: INestApplication
  let server: Server
  let dataSource: DataSource

  beforeAll(async () => {
    dataSource = createDataSource(config)
    await dataSource.initialize()
    await dataSource.runMigrations()

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalFilters(new HttpExceptionFilter())
    await app.init()
    server = app.getHttpServer() as Server
  })

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "users" WHERE "email" <> $1', [admin.email])
  })

  afterAll(async () => {
    await app?.close()
    await dataSource?.destroy()
  })

  // Inicia sesión y devuelve la cabecera Authorization lista para usar
  async function login(email: string, password: string): Promise<string> {
    const response = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200)
    const body = LoginResponseSchema.parse(response.body)
    return `Bearer ${body.token}`
  }

  it('crea al administrador inicial y le permite entrar', async () => {
    const response = await request(server)
      .post('/api/auth/login')
      .send({ email: admin.email.toUpperCase(), password: admin.password })
      .expect(200)

    expect(LoginResponseSchema.parse(response.body).user).toMatchObject({
      email: admin.email,
      role: 'admin',
    })
    expect(JSON.stringify(response.body)).not.toContain('password')

    const me = await request(server)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${response.body.token as string}`)
      .expect(200)
    expect(me.body).toMatchObject({ email: admin.email, role: 'admin' })
  })

  it('responde igual a un correo inexistente que a una contraseña errada', async () => {
    const wrong = await request(server)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'no-es-la-clave' })
      .expect(401)
    const missing = await request(server)
      .post('/api/auth/login')
      .send({ email: 'nadie@vigia.local', password: 'no-es-la-clave' })
      .expect(401)
    expect(wrong.body).toEqual({ detail: 'Correo o contraseña incorrectos.' })
    expect(missing.body).toEqual(wrong.body)
  })

  it('valida el formulario de ingreso', async () => {
    const response = await request(server)
      .post('/api/auth/login')
      .send({ email: 'no-es-correo', password: 'x' })
      .expect(422)
    expect(response.body).toEqual({ detail: 'Escribe un correo válido.' })
  })

  it('bloquea tras varios intentos fallidos seguidos', async () => {
    const email = 'bloqueo@vigia.local'
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(server).post('/api/auth/login').send({ email, password: 'x' }).expect(401)
    }
    await request(server).post('/api/auth/login').send({ email, password: 'x' }).expect(429)
  })

  it('el administrador crea analistas que pueden entrar pero no administrar', async () => {
    const adminAuth = await login(admin.email, admin.password)

    const created = await request(server)
      .post('/api/users')
      .set('Authorization', adminAuth)
      .send({ email: 'Ana@Diresa.pe', name: 'Ana', password: 'clave-de-ana', role: 'analyst' })
      .expect(201)
    expect(UserSchema.parse(created.body)).toMatchObject({
      email: 'ana@diresa.pe',
      role: 'analyst',
    })

    await request(server)
      .post('/api/users')
      .set('Authorization', adminAuth)
      .send({ email: 'ana@diresa.pe', name: 'Otra', password: 'clave-de-ana', role: 'analyst' })
      .expect(409)

    const analystAuth = await login('ana@diresa.pe', 'clave-de-ana')
    await request(server).get('/api/uploads').set('Authorization', analystAuth).expect(200)
    await request(server).get('/api/users').set('Authorization', analystAuth).expect(403)
    const forbidden = await request(server)
      .delete('/api/uploads')
      .set('Authorization', analystAuth)
      .expect(403)
    expect(forbidden.body).toEqual({ detail: 'Solo un administrador puede hacer esto.' })

    const list = await request(server).get('/api/users').set('Authorization', adminAuth).expect(200)
    expect((list.body as { email: string }[]).map((user) => user.email)).toEqual([
      admin.email,
      'ana@diresa.pe',
    ])
  })

  it('al eliminar un usuario su sesión deja de valer; no se borra a sí mismo', async () => {
    const adminAuth = await login(admin.email, admin.password)
    const created = await request(server)
      .post('/api/users')
      .set('Authorization', adminAuth)
      .send({
        email: 'temp@vigia.local',
        name: 'Temporal',
        password: 'clave-temporal',
        role: 'analyst',
      })
      .expect(201)
    const tempAuth = await login('temp@vigia.local', 'clave-temporal')

    await request(server)
      .delete(`/api/users/${created.body.id as number}`)
      .set('Authorization', adminAuth)
      .expect(204)
    await request(server).get('/api/uploads').set('Authorization', tempAuth).expect(401)

    const me = await request(server).get('/api/auth/me').set('Authorization', adminAuth)
    const self = await request(server)
      .delete(`/api/users/${me.body.id as number}`)
      .set('Authorization', adminAuth)
      .expect(422)
    expect(self.body).toEqual({ detail: 'No puedes eliminar tu propio usuario.' })
  })

  it('rechaza contraseñas cortas', async () => {
    const adminAuth = await login(admin.email, admin.password)
    const response = await request(server)
      .post('/api/users')
      .set('Authorization', adminAuth)
      .send({ email: 'corta@vigia.local', name: 'Corta', password: '123', role: 'analyst' })
      .expect(422)
    expect(response.body).toEqual({ detail: 'La contraseña debe tener al menos 8 caracteres.' })
  })
})
