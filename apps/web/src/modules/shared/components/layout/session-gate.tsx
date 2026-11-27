'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

import { wasSignedOut } from '../../api'
import { useSession } from '../../hooks'
import { Logo } from '../ui'

// Muestra el panel solo con una sesión vigente; si no la hay, lleva al inicio de sesión
export function SessionGate({ children }: { children: ReactNode }) {
  const { session, ready } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (ready && !session) {
      const keep = pathname !== '/' && !wasSignedOut()
      const next = keep ? `?next=${encodeURIComponent(pathname)}` : ''
      router.replace(`/login${next}`)
    }
  }, [ready, session, pathname, router])

  if (!session) {
    return (
      <div className="splash" role="status" aria-label="Comprobando tu sesión">
        <Logo size={56} />
      </div>
    )
  }
  return children
}
