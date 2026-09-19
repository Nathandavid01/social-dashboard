import type { IdeaWithPipeline } from '@/lib/supabase/types'

/** Same readiness gate as crearEnlaceCliente: edited file in entregas-r2, usable. */
export function ideaTieneEditadoEntregas(idea: Pick<IdeaWithPipeline, 'videos'>): boolean {
  return (idea.videos ?? []).some(
    (v) =>
      v.kind === 'edited' &&
      v.storage_provider === 'entregas-r2' &&
      v.status !== 'failed' &&
      v.status !== 'archived' &&
      !!v.drive_file_id,
  )
}
