// Aviso de error accesible con el mensaje recibido
export function ErrorBanner({ message, className = '' }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      className={`rounded-[var(--radius-sm)] border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger ${className}`}
    >
      {message}
    </div>
  )
}
