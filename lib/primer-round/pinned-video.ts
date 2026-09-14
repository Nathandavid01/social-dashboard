/** Pin Primer Round work to the file just uploaded. Never fall back to leftover GFX. */

export const PRIMER_ROUND_PIN_MISSING =
  'Falta el video de esta subida. No se usa otro archivo.'
export const PRIMER_ROUND_PIN_GONE = 'El video de esta pieza ya no está disponible'
export const PRIMER_ROUND_PIN_MISMATCH =
  'Este video no es el que acabas de subir. No se trabaja el archivo anterior.'

export function assertPrimerRoundPinnedVideo(input: {
  requestedVideoId?: string | null
  /** Omit while the row is still loading. Pass null when the lookup found nothing. */
  ideaVideoId?: string | null
}): string | null {
  const requested = input.requestedVideoId?.trim() || ''
  if (!requested) return PRIMER_ROUND_PIN_MISSING
  if (!('ideaVideoId' in input)) return null
  const onIdea = input.ideaVideoId?.trim() || ''
  if (!onIdea) return PRIMER_ROUND_PIN_GONE
  if (onIdea !== requested) return PRIMER_ROUND_PIN_MISMATCH
  return null
}
