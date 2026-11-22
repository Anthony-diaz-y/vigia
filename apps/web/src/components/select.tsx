'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption<T extends string | number> {
  value: T
  label: string
  hint?: string
}

interface SelectProps<T extends string | number> {
  value: T
  options: ReadonlyArray<SelectOption<T>>
  onChange: (value: T) => void
  label: string
  caption?: string
  icon?: ReactNode
  disabled?: boolean
  className?: string
}

interface Position {
  top: number
  left: number
  minWidth: number
  maxHeight: number
  above: boolean
}

const GAP = 6
const MAX_HEIGHT = 320

// Selector accesible con lista flotante en portal, navegación completa por teclado y búsqueda por letra
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
  caption,
  icon,
  disabled = false,
  className = '',
}: SelectProps<T>) {
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState<Position | null>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const selected = options[selectedIndex]

  // Calcula dónde ubicar la lista (arriba o abajo) y en qué contenedor renderizarla
  const place = useCallback(() => {
    const button = buttonRef.current
    if (!button) {
      return
    }
    setHost(button.closest('dialog') ?? document.body)
    const rect = button.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom - GAP - 8
    const aboveSpace = rect.top - GAP - 8
    const above = below < 200 && aboveSpace > below
    const maxHeight = Math.min(MAX_HEIGHT, above ? aboveSpace : below)
    const minWidth = Math.max(rect.width, 200)
    const viewport = document.documentElement.clientWidth
    setPosition({
      top: above ? rect.top - GAP : rect.bottom + GAP,
      left: Math.max(8, rect.left + minWidth > viewport - 8 ? rect.right - minWidth : rect.left),
      minWidth,
      maxHeight,
      above,
    })
  }, [])

  // Abre la lista marcando la opción seleccionada como activa
  const openList = () => {
    if (disabled || options.length === 0) {
      return
    }
    setActive(selectedIndex)
    place()
    setClosing(false)
    setOpen(true)
  }

  // Cierra la lista con animación y opcionalmente devuelve el foco al botón
  const closeList = useCallback((focusButton = true) => {
    setClosing(true)
    window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, 120)
    if (focusButton) {
      buttonRef.current?.focus()
    }
  }, [])

  // Selecciona la opción del índice dado y cierra la lista
  const choose = (index: number) => {
    const option = options[index]
    if (option) {
      onChange(option.value)
    }
    closeList()
  }

  useEffect(() => {
    if (!open) {
      return
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !listRef.current?.contains(target)) {
        closeList(false)
      }
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place, closeList])

  useLayoutEffect(() => {
    if (open) {
      listRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  // Abre la lista con flechas, Enter o Espacio desde el botón
  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openList()
    }
  }

  // Maneja el teclado dentro de la lista: mover, elegir, cerrar y buscar por letra
  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((index) => Math.min(last, index + 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((index) => Math.max(0, index - 1))
        break
      case 'Home':
        event.preventDefault()
        setActive(0)
        break
      case 'End':
        event.preventDefault()
        setActive(last)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        choose(active)
        break
      case 'Escape':
        event.preventDefault()
        closeList()
        break
      case 'Tab':
        closeList(false)
        break
      default:
        if (event.key.length === 1) {
          const key = event.key.toLowerCase()
          const start = active + 1
          const ordered = [...options.slice(start), ...options.slice(0, start)]
          const match = ordered.findIndex((option) => option.label.toLowerCase().startsWith(key))
          if (match >= 0) {
            setActive((start + match) % options.length)
          }
        }
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`select-trigger${open ? ' is-open' : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={`${label}: ${selected?.label ?? ''}`}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onButtonKey}
      >
        {icon && <span className="select-icon">{icon}</span>}
        <span className="select-text">
          {caption && <span className="select-caption">{caption}</span>}
          <span className="select-value">{selected?.label ?? '—'}</span>
        </span>
        <svg
          className="select-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open &&
        position &&
        host &&
        createPortal(
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${id}-opt-${active}`}
            className={`select-list${position.above ? ' is-above' : ''}${closing ? ' is-closing' : ''}`}
            style={{
              top: position.above ? undefined : position.top,
              bottom: position.above ? window.innerHeight - position.top : undefined,
              left: position.left,
              minWidth: position.minWidth,
              maxHeight: position.maxHeight,
            }}
            onKeyDown={onListKey}
          >
            {options.map((option, index) => {
              const isSelected = index === selectedIndex
              return (
                <li
                  key={String(option.value)}
                  id={`${id}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={`select-option${index === active ? ' is-active' : ''}`}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <span className="select-option-text">
                    <span>{option.label}</span>
                    {option.hint && <span className="select-option-hint">{option.hint}</span>}
                  </span>
                  {isSelected && (
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </li>
              )
            })}
          </ul>,
          host,
        )}
    </>
  )
}
