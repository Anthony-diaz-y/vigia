'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'

import { Logo } from '@/modules/shared/components/ui'
import { useLogin, useSession } from '@/modules/shared/hooks'
import { errorMessage } from '@/modules/shared/utils'

import { WatchCurve } from './watch-curve'

// Ruta interna a la que volver tras entrar; evita redirecciones a otros sitios
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

// Pantalla de inicio de sesión con la ilustración de vigía y el formulario
export function LoginPage() {
  const router = useRouter()
  const next = safeNext(useSearchParams().get('next'))
  const { session, ready } = useSession()
  const loginMutation = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (ready && session) {
      router.replace(next)
    }
  }, [ready, session, next, router])

  // Envía el formulario de ingreso
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    loginMutation.mutate({ email: email.trim(), password })
  }

  const error = loginMutation.isError ? errorMessage(loginMutation.error) : null

  return (
    <div className="login">
      <section className="login-hero" aria-hidden="true">
        <div className="login-brand">
          <Logo size={48} />
          <span>vigia</span>
        </div>
        <div className="login-story">
          <WatchCurve />
          <p className="login-claim">Sube un archivo de salud. Vigia lo convierte en alertas.</p>
          <p className="login-detail">
            Tableros, anomalías y pronósticos que se adaptan a cada dataset: dengue, anemia, egresos
            u otro.
          </p>
        </div>
      </section>

      <main className="login-panel">
        <form className="login-form" onSubmit={onSubmit} noValidate>
          <div className="login-mobile-brand">
            <Logo size={40} />
            <span>vigia</span>
          </div>
          <h1 className="login-title">Inicia sesión</h1>
          <p className="login-sub">Entra con la cuenta que te dio el administrador de Vigia.</p>

          <label className="login-field">
            <span>Correo</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="login-field">
            <span>Contraseña</span>
            <span className="login-password">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="login-reveal"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </span>
          </label>

          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loginMutation.isPending || !email || !password}
          >
            {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="login-help">
            ¿No tienes cuenta o olvidaste la contraseña? Pídesela al administrador de Vigia.
          </p>
        </form>
      </main>
    </div>
  )
}
