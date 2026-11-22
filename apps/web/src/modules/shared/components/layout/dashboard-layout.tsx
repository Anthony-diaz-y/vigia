'use client'

import { useIsFetching } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'

import { DISCLAIMER, type UploadPreview } from '@vigia/contracts'

import { EMPTY_SERIES, EMPTY_UPLOADS } from '../../constants'
import { navItemForPath } from '../../constants/navigation'
import { DashboardFiltersProvider } from '../../contexts'
import {
  useAccessToken,
  useClearUploads,
  useHealth,
  useRefreshData,
  useSelectedYear,
  useSeries,
  useTheme,
  useUploadFile,
  useUploadPreview,
  useUploads,
} from '../../hooks'
import { errorMessage } from '../../utils'
import { EmptyState, ErrorBanner } from '../ui'
import type { AccessControl } from './access-control'
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

  const [activeUploadId, setActiveUploadId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingUpload | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadsQuery = useUploads()
  const uploads = uploadsQuery.data ?? EMPTY_UPLOADS
  const hasUploads = uploads.length > 0

  const series = useSeries(activeUploadId, hasUploads).data ?? EMPTY_SERIES
  const years = useMemo(
    () => [...new Set(series.map((row) => row.year))].sort((left, right) => right - left),
    [series],
  )
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
  const onConfirmUpload = (mapping: Record<string, string>) => {
    if (!pending) {
      return
    }
    setError(null)
    uploadMutation.mutate(
      { file: pending.file, mapping },
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

  const access: AccessControl = {
    token,
    onTokenChange: changeToken,
    onTokenCommit: refresh,
    onClear,
    canClear: hasUploads && !busy,
  }

  return (
    <DashboardFiltersProvider uploadId={activeUploadId} year={year}>
      <div className="flex min-h-screen">
        <Sidebar uploads={uploads} access={access} />

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav />

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
                {children}
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
          aria-label="Archivo de vigilancia"
        />

        {pending && (
          <MappingDialog
            preview={pending.preview}
            busy={busy}
            onCancel={() => setPending(null)}
            onConfirm={onConfirmUpload}
          />
        )}
      </div>
    </DashboardFiltersProvider>
  )
}
