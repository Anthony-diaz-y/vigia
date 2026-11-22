export interface AccessControl {
  token: string
  onTokenChange: (value: string) => void
  onTokenCommit: () => void
  onClear: () => void
  canClear: boolean
}

// Campo del token de acceso, usado en la barra lateral y en los ajustes móviles
export function TokenInput({
  access,
  className = '',
  inputClassName = 'input',
  labelClassName = '',
}: {
  access: AccessControl
  className?: string
  inputClassName?: string
  labelClassName?: string
}) {
  return (
    <label className={className}>
      <span className={labelClassName}>Token de acceso</span>
      <input
        type="password"
        className={inputClassName}
        value={access.token}
        autoComplete="off"
        onChange={(event) => access.onTokenChange(event.target.value)}
        onBlur={access.onTokenCommit}
      />
    </label>
  )
}

// Botón para borrar todos los datos ingeridos
export function ClearDataButton({
  access,
  className,
}: {
  access: AccessControl
  className: string
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={access.onClear}
      disabled={!access.canClear}
    >
      Borrar todos los datos
    </button>
  )
}
