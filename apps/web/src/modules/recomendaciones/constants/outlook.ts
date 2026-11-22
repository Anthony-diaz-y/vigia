import type { OutlookDto } from '@vigia/contracts'

export const CONFIDENCE_LABEL: Record<OutlookDto['confidence'], string> = {
  baja: 'Confianza baja',
  media: 'Confianza media',
  alta: 'Confianza alta',
}
