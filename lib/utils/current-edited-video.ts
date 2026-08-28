/**
 * El corte que la pantalla está mostrando: el edited vivo más reciente.
 *
 * Es el archivo que el aprobador tiene delante (alimenta la tira de escenas y
 * las bolitas del QC IA), así que es el que se sella en `approved_video_id` al
 * aprobar. Una sola definición para que la vista y el sello no puedan
 * discrepar.
 */
export interface EditedVideoLike {
  id: string
  uploaded_at?: string | null
  status?: string | null
}

export function currentEditedVideoId(edited: EditedVideoLike[] | null | undefined): string | null {
  const live = (edited ?? []).filter((v) => v.status !== 'archived' && v.status !== 'failed')
  if (live.length === 0) return null
  return (
    [...live].sort((a, b) => (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? ''))[0]?.id ?? null
  )
}
