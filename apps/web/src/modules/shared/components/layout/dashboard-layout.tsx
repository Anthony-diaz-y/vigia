'use client'

import { useIsFetching } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'

import { DISCLAIMER, type UploadPreview } from '@vigia/contracts'

import { EMPTY_UPLOADS, EMPTY_YEARS } from '../../constants'
import { NAV_ITEMS, isAvailable, navItemForPath } from '../../constants/navigation'
import { DashboardFiltersProvider } from '../../contexts'
import {
  useAccessToken,
  defaultIndicatorId,
  useClearUploads,
  useHealth,
  useRefreshData,
  useSelectedYear,
  useTheme,
  useUploadFile,
  useUploadPreview,
  useUploadYears,
  useUploads,
} from '../../hooks'
import { errorMessage } from '../../utils'
import { EmptyState, ErrorBanner, UnavailableState } from '../ui'
import type { AccessControl } from './access-control'
import type { UploadReview } from '../../services/uploads.service'
import { MappingDialog } from './mapping-dialog'
import { MobileNav, Sidebar } from './navigation'
import { Topbar } from './topbar'

interface PendingUpload {
  file: File
  preview: UploadPreview
}

// Layout del tablero: navegación, filtros, carga de archivos y descargo de responsabilidad
export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const current = navItemForPath(pathname)

  const { theme, toggleTheme } = useTheme()
  const { token, changeToken } = useAccessToken()
  const refresh = useRefreshData()

  const [pickedUploadId, setActiveUploadId] = useState<number | null>(null)
  const [pickedIndicator, setIndicator] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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
  const clearMutation = useClearUploads()

  const busy =
    useIsFetching() > 0 ||
    previewMutation.isPending ||
    uploadMutation.isPending ||
    clearMutation.isPending

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
          setActiveUploadId(created.id)
          setPending(null)
        },
        onError: (caught) => setError(errorMessage(caught)),
      },
    )
  }

  // Borra todos los datos cargados tras pedir confirmación
  const onClear = () => {
    if (!window.confirm('¿Borrar todos los datos ingeridos?')) {
      return
    }
    setError(null)
    clearMutation.mutate(undefined, {
      onSuccess: () => setActiveUploadId(null),
      onError: (caught) => setError(errorMessage(caught)),
    })
  }

  const navItems = NAV_ITEMS.filter((item) => isAvailable(item, activeUpload))

  const access: AccessControl = {
    token,
    onTokenChange: changeToken,
    onTokenCommit: refresh,
    onClear,
    canClear: hasUploads && !busy,
  }

  return (
    <DashboardFiltersProvider
      upload={activeUpload}
      year={year}
      yearsReady={yearsQuery.isSuccess}
      indicator={indicator}
    >
      <div className="flex min-h-screen">
        <Sidebar uploads={uploads} items={navItems} access={access} />

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav items={navItems} />

          <Topbar
            title={current.label}
            description={current.description}
            filters={{
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
            access={access}
          />

          <main className="main">
            {error && <ErrorBanner message={error} />}
            {uploadsQuery.isError && <ErrorBanner message={errorMessage(uploadsQuery.error)} />}
            {uploadsQuery.isSuccess && !hasUploads && <EmptyState onUpload={openFileDialog} />}
            {hasUploads && (
              <div key={pathname} className="view-enter flex flex-col gap-[18px]">
                {isAvailable(current, activeUpload) ? (
                  children
                ) : (
                  <UnavailableState page={current.label} />
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
