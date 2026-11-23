import type { UploadDto } from '@vigia/contracts'

import type { Theme } from '../../constants/theme'
import { formatNumber } from '../../utils'
import {
  CalendarIcon,
  ChartIcon,
  FileIcon,
  MoonIcon,
  RefreshIcon,
  Select,
  SunIcon,
  UploadIcon,
  type SelectOption,
} from '../ui'
import { ClearDataButton, TokenInput, type AccessControl } from './access-control'

interface TopbarFilters {
  uploads: ReadonlyArray<UploadDto>
  activeUploadId: number | null
  onUploadChange: (id: number) => void
  years: ReadonlyArray<number>
  year: number | null
  onYearChange: (year: number) => void
  showYear: boolean
  indicators: ReadonlyArray<{ id: string; label: string }>
  indicator: string | null
  onIndicatorChange: (indicator: string) => void
}

interface TopbarProps {
  title: string
  description: string
  filters: TopbarFilters
  busy: boolean
  theme: Theme | null
  onToggleTheme: () => void
  onRefresh: () => void
  onUploadClick: () => void
  access: AccessControl
}

// Encabezado con el título de la página, los filtros y las acciones globales
export function Topbar({
  title,
  description,
  filters,
  busy,
  theme,
  onToggleTheme,
  onRefresh,
  onUploadClick,
  access,
}: TopbarProps) {
  const fileOptions: SelectOption<number>[] = filters.uploads.map((row) => ({
    value: row.id,
    label: row.title || row.filename,
    hint: `${row.topic ? `${row.topic}, ` : ''}${formatNumber(row.rows_in)} filas`,
  }))
  const indicatorOptions: SelectOption<string>[] = filters.indicators.map((option) => ({
    value: option.id,
    label: option.label,
  }))
  const yearOptions: SelectOption<number>[] = filters.years.map((value) => ({
    value,
    label: String(value),
  }))

  return (
    <header className="topbar">
      <div className="min-w-0 flex-1">
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">{description}</p>
      </div>
      <div className="toolbar">
        <div className="toolbar-group grow">
          <Select
            label="Archivo a analizar"
            caption="Archivo"
            icon={<FileIcon />}
            value={filters.activeUploadId ?? 0}
            options={fileOptions}
            onChange={filters.onUploadChange}
            disabled={busy || filters.uploads.length === 0}
          />
          {indicatorOptions.length > 1 && filters.indicator !== null && (
            <>
              <span className="toolbar-divider" aria-hidden="true" />
              <Select
                label="Indicador"
                caption="Indicador"
                icon={<ChartIcon />}
                value={filters.indicator}
                options={indicatorOptions}
                onChange={filters.onIndicatorChange}
                disabled={busy}
              />
            </>
          )}
          {filters.showYear && filters.year !== null && (
            <>
              <span className="toolbar-divider" aria-hidden="true" />
              <Select
                label="Año"
                icon={<CalendarIcon />}
                value={filters.year}
                options={yearOptions}
                onChange={filters.onYearChange}
                disabled={busy}
              />
            </>
          )}
        </div>
        <div className="toolbar-group">
          <button
            type="button"
            className="icon-btn"
            onClick={onRefresh}
            disabled={busy}
            data-tip="Actualizar"
            aria-label="Actualizar datos"
          >
            <RefreshIcon spinning={busy} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            data-tip={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            <span key={theme ?? 'none'} className="theme-icon">
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </span>
          </button>
        </div>
        <button type="button" className="btn btn-primary" onClick={onUploadClick} disabled={busy}>
          <UploadIcon /> Subir archivo
        </button>
        <details className="mobile-settings md:hidden">
          <summary className="btn">Ajustes</summary>
          <div className="mobile-settings-panel">
            <TokenInput access={access} className="flex flex-col gap-1 text-xs text-muted" />
            <ClearDataButton access={access} className="btn text-danger" />
          </div>
        </details>
      </div>
      {busy && <div className="loading-bar" role="progressbar" aria-label="Cargando datos" />}
    </header>
  )
}
