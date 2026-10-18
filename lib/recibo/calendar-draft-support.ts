import type { IdeaWithPipeline } from '@/lib/supabase/types'

/** Calendar drafting uses the AI delivery pool; other Recibo sources remain visible. */
export function calendarDraftUnavailableReason(idea: IdeaWithPipeline, videoId: string): string | null {
  if (idea.client?.edit_mode !== 'ai') return 'Borrador desde calendario no disponible: requiere un cliente con edición AI configurada.'
  if (!idea.videos?.some(file => file.id === videoId && file.storage_provider === 'entregas-r2')) return 'Borrador desde calendario no disponible: este archivo requiere el flujo de entrega correspondiente.'
  return null
}
