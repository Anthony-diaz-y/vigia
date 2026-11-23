import { normalizeHeader } from '../infrastructure/mapping'

// Deduce el tema cuando no hay IA: dengue si el nombre lo dice o si tiene el formato MINSA clásico
export function inferTopic(
  filename: string,
  source: string,
  mapping: Record<string, string>,
): string {
  const classic = ['ubigeo', 'year', 'epi_week'].every((field) => mapping[field] !== undefined)
  return normalizeHeader(filename).includes('dengue') || (source === 'minsa_dengue' && classic)
    ? 'dengue'
    : ''
}
