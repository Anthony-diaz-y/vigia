'use client'

import { useRouter } from 'next/navigation'

import type { SessionUser } from '@vigia/contracts'

import { ROLE_LABELS } from '../../constants'
import { useLogout } from '../../hooks'
import { LogoutIcon } from '../ui'

// Iniciales del nombre para el avatar
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase()
}

// Tarjeta del usuario con su rol y el botón para cerrar sesión
export function UserCard({ user, variant }: { user: SessionUser; variant: 'rail' | 'menu' }) {
  const logout = useLogout()
  const router = useRouter()

  // Cierra la sesión y vuelve a la pantalla de ingreso
  const onLogout = () => {
    logout()
    router.replace('/login')
  }

  return (
    <div className={`user-card user-card-${variant}`}>
      <span className="user-avatar" aria-hidden="true">
        {initials(user.name) || '?'}
      </span>
      <span className="user-text">
        <span className="user-name">{user.name}</span>
        <span className="user-role">{ROLE_LABELS[user.role]}</span>
      </span>
      <button
        type="button"
        className="user-logout"
        onClick={onLogout}
        aria-label="Cerrar sesión"
        data-tip="Cerrar sesión"
      >
        <LogoutIcon />
      </button>
    </div>
  )
}
