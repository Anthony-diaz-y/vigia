import type { UserRole } from '@vigia/contracts'

export const UPLOAD_STATUS_LABELS: Record<string, string> = {
  ok: 'OK',
  ok_with_issues: 'OK con observaciones',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  analyst: 'Analista',
}

export const FORECAST_STATUS_LABELS: Record<string, string> = {
  publish: 'Confiable',
  insufficient_evidence: 'No confiable aún',
}
