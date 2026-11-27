'use client'

import { useIsFetching } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'

import { DISCLAIMER, type UploadPreview } from '@vigia/contracts'

import { EMPTY_UPLOADS, EMPTY_YEARS } from '../../constants'
import { NAV_ITEMS, canSee, isAvailable, navItemForPath } from '../../constants/navigation'
import { DashboardFiltersProvider } from '../../contexts'
import {
  defaultIndicatorId,
  useHealth,
  useRefreshData,
  useSelectedYear,
  useSession,
  useTheme,
  useUploadFile,
  useUploadPreview,
  useUploadYears,
  useUploads,
} from '../../hooks'
import { errorMessage } from '../../utils'
import { CloseIcon, EmptyState, ErrorBanner, UnavailableState } from '../ui'
import type { UploadReview } from '../../services/uploads.service'
import { MappingDialog } from './mapping-dialog'
import { MobileNav, Sidebar } from './navigation'
import { SessionGate } from './session-gate'
import { Topbar } from './topbar'

interface PendingUpload {
  file: File
  preview: UploadPreview
}

// Layout del tablero, visible solo con una sesión vigente
export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGate>
      <DashboardShell>{children}</DashboardShell>
    </SessionGate>
  )
}

// Navegación, filtros, carga de archivos y descargo de responsabilidad
function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user } = useSession()
  const current = navItemForPath(pathname)

  const { theme, toggleTheme } = useTheme()
  const refresh = useRefreshData()

  const [pickedUploadId, setActiveUploadId] = useState<number | null>(null)
  const [pickedIndicator, setIndicator] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingUpload | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadsQuery = useUploads()
  const uploads = uploadsQuery.data ?? EMPTY_UPLOADS
  const hasUploads = uploads.length > 0

  const activeUpload = uploads.find((upload) => upload.id === pickedUploadId) ?? uploads[0] ?? null
  const activeUploadId = activeUpload?.id ?? null
  const indicator = activeUpload?.indicators.some((option) => option.id === pickedIndicator)
    ? pickedIndicator
    : null

  const yearsQuery = useUploadYears(activeUploadId)
  const years = yearsQuery.data ?? EMPTY_YEARS
  const [year, setYear] = useSelectedYear(years)

  const { data: health } = useHealth()

  const previewMutation = useUploadPreview()
  const uploadMutation = useUploadFile()

  const busy = useIsFetching() > 0 || previewMutation.isPending || uploadMutation.isPending

  // Abre el selector de archivos del sistema
  const openFileDialog = () => fileRef.current?.click()

  // Pide la vista previa del archivo elegido para revisar el mapeo de columnas
  const onFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    setError(null)
    setNotice(null)
    previewMutation.mutate(file, {
      onSuccess: (preview) => setPending({ file, preview }),
      onError: (caught) => setError(errorMessage(caught)),
    })
  }

  // Sube el archivo con el mapeo confirmado y lo deja como archivo activo
  const onConfirmUpload = (review: UploadReview) => {
    if (!pending) {
      return
    }
    setError(null)
    uploadMutation.mutate(
      { file: pending.file, review },
      {
        onSuccess: (created) => {
          const repeated = uploads.some((upload) => upload.id === created.id)
          setNotice(
            repeated
              ? `Este archivo ya estaba cargado con el mismo contenido. Se abrió «${created.title || created.filename}».`
              : null,
          )
          setActiveUploadId(created.id)
          setPending(null)
        },
        onError: (caught) => setError(errorMessage(caught)),
      },
    )
  }

  const navItems = NAV_ITEMS.filter((item) => canSee(item, user) && isAvailable(item, activeUpload))
  const standalone = current.requires === 'none'
  const permitted = canSee(current, user)
  const allowed = permitted && isAvailable(current, activeUpload)

  return (
    <DashboardFiltersProvider
      upload={activeUpload}
      year={year}
      yearsReady={yearsQuery.isSuccess}
      indicator={indicator}
    >
      <div className="flex min-h-screen">
        <Sidebar uploads={uploads} items={navItems} user={user} />

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav items={navItems} user={user} />

          <Topbar
            title={current.label}
            description={current.description}
            filters={{
              hidden: standalone,
              uploads,
              activeUploadId,
              onUploadChange: setActiveUploadId,
              years,
              year,
              onYearChange: setYear,
              showYear: current.usesYear,
              indicators: current.usesIndicator ? (activeUpload?.indicators ?? []) : [],
              indicator: indicator ?? defaultIndicatorId(activeUpload),
              onIndicatorChange: setIndicator,
            }}
            busy={busy}
            theme={theme}
            onToggleTheme={toggleTheme}
            onRefresh={refresh}
            onUploadClick={openFileDialog}
          />

          <main className="main">
            {error && <ErrorBanner message={error} />}
            {notice && (
              <p role="status" className="notice">
                {notice}
                <button
                  type="button"
                  className="notice-close"
                  onClick={() => setNotice(null)}
                  aria-label="Cerrar aviso"
                >
                  <CloseIcon />
                </button>
              </p>
            )}
            {uploadsQuery.isError && <ErrorBanner message={errorMessage(uploadsQuery.error)} />}
            {uploadsQuery.isSuccess && !hasUploads && !standalone && (
              <EmptyState onUpload={openFileDialog} />
            )}
            {(hasUploads || standalone) && (
              <div key={pathname} className="view-enter flex flex-col gap-[18px]">
                {allowed ? (
                  children
                ) : permitted ? (
                  <UnavailableState page={current.label} />
                ) : (
                  <section className="card">
                    <h2 className="section-title">Solo para administradores</h2>
                    <p className="card-sub">
                      Tu cuenta es de analista. Pide a un administrador de Vigia que haga este
                      cambio.
                    </p>
                  </section>
                )}
              </div>
            )}
          </main>

          <footer className="disclaimer">{health?.disclaimer ?? DISCLAIMER}</footer>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.xlsx"
          onChange={onFileSelected}
          className="hidden"
          aria-label="Archivo de datos"
        />

        {pending && (
          <MappingDialog
            preview={pending.preview}
            filename={pending.file.name}
            busy={busy}
            onCancel={() => setPending(null)}
            onConfirm={onConfirmUpload}
          />
        )}
      </div>
    </DashboardFiltersProvider>
  )
}
