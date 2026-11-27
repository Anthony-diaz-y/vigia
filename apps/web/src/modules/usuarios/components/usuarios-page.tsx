'use client'

import { useState, type FormEvent } from 'react'

import type { UserDto, UserRole } from '@vigia/contracts'

import {
  ConfirmDialog,
  ErrorBanner,
  Section,
  Select,
  type SelectOption,
} from '@/modules/shared/components/ui'
import { ROLE_LABELS } from '@/modules/shared/constants'
import { useCreateUser, useDeleteUser, useSession, useUsers } from '@/modules/shared/hooks'
import { errorMessage } from '@/modules/shared/utils'

const ROLE_OPTIONS: SelectOption<UserRole>[] = [
  { value: 'analyst', label: ROLE_LABELS.analyst, hint: 'Sube archivos y ve todos los análisis.' },
  {
    value: 'admin',
    label: ROLE_LABELS.admin,
    hint: 'Además crea usuarios y puede borrar los datos.',
  },
]

const EMPTY_FORM = { name: '', email: '', password: '', role: 'analyst' as UserRole }

// Fecha corta en español para la columna de alta
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Página de usuarios: lista, alta y baja de cuentas (solo administradores)
export function UsuariosPage() {
  const { user } = useSession()
  const usersQuery = useUsers(user?.role === 'admin')
  const createMutation = useCreateUser()
  const deleteMutation = useDeleteUser()
  const [form, setForm] = useState(EMPTY_FORM)
  const [removing, setRemoving] = useState<UserDto | null>(null)
  const [created, setCreated] = useState<string | null>(null)

  // Crea la cuenta y limpia el formulario
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreated(null)
    createMutation.mutate(form, {
      onSuccess: (account) => {
        setCreated(`${account.name} ya puede entrar con ${account.email}.`)
        setForm(EMPTY_FORM)
      },
    })
  }

  // Elimina la cuenta confirmada
  const onRemove = () => {
    if (!removing) {
      return
    }
    deleteMutation.mutate(removing.id, { onSuccess: () => setRemoving(null) })
  }

  return (
    <div className="users-layout">
      <Section title="Cuentas con acceso">
        {usersQuery.isPending && <p className="text-sm text-muted">Cargando usuarios…</p>}
        {usersQuery.isError && <ErrorBanner message={errorMessage(usersQuery.error)} />}
        {deleteMutation.isError && (
          <ErrorBanner className="mb-3" message={errorMessage(deleteMutation.error)} />
        )}
        {usersQuery.data && (
          <ul className="user-list">
            {usersQuery.data.map((account) => (
              <li key={account.id} className="user-row">
                <span className="user-avatar" aria-hidden="true">
                  {account.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="user-row-name">
                    {account.name}
                    {account.id === user?.id && <span className="user-you">Tú</span>}
                  </span>
                  <span className="user-row-email">{account.email}</span>
                </span>
                <span className={`badge ${account.role === 'admin' ? 'badge-ok' : ''}`}>
                  {ROLE_LABELS[account.role]}
                </span>
                <span className="user-row-date">Desde {shortDate(account.created_at)}</span>
                <button
                  type="button"
                  className="link-btn text-danger"
                  onClick={() => setRemoving(account)}
                  disabled={account.id === user?.id}
                  aria-label={`Eliminar a ${account.name}`}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Agregar una cuenta">
        <form className="user-form" onSubmit={onSubmit}>
          <label className="map-field">
            <span>Nombre</span>
            <input
              className="input"
              required
              maxLength={80}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="map-field">
            <span>Correo</span>
            <input
              className="input"
              type="email"
              required
              autoComplete="off"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label className="map-field">
            <span>Contraseña inicial</span>
            <input
              className="input"
              type="text"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Al menos 8 caracteres"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <div className="map-field">
            <span>Permisos</span>
            <Select
              className="is-boxed"
              label="Permisos de la cuenta"
              value={form.role}
              options={ROLE_OPTIONS}
              onChange={(role) => setForm({ ...form, role })}
            />
          </div>
          {createMutation.isError && <ErrorBanner message={errorMessage(createMutation.error)} />}
          {created && (
            <p role="status" className="user-created">
              {created} Compártele la contraseña por un medio seguro.
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              createMutation.isPending || !form.name || !form.email || form.password.length < 8
            }
          >
            {createMutation.isPending ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>
      </Section>

      {removing && (
        <ConfirmDialog
          title={`¿Eliminar a ${removing.name}?`}
          confirmLabel="Eliminar cuenta"
          busy={deleteMutation.isPending}
          onCancel={() => setRemoving(null)}
          onConfirm={onRemove}
        >
          {removing.email} ya no podrá entrar a Vigia. Los archivos que subió se conservan.
        </ConfirmDialog>
      )}
    </div>
  )
}
