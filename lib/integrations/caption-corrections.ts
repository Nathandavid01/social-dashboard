import type { SupabaseClient } from '@supabase/supabase-js'
import { seleccionarCorrecciones, type CaptionCorrection } from '@/lib/utils/caption-corrections'

/**
 * Últimas correcciones del equipo PARA ESTE CLIENTE (aprendizaje por
 * corrección — ver supabase/migrations/0066_caption_corrections.sql).
 * Best-effort: si la tabla no existe (migración sin aplicar) o cualquier otro
 * error de Supabase, devuelve vacío — la generación de captions nunca se
 * rompe por esto.
 */
export async function fetchCaptionCorrectionsForPrompt(
  supabase: SupabaseClient,
  clientId: string | null | undefined,
): Promise<CaptionCorrection[]> {
  if (!clientId) return []
  try {
    const { data } = await supabase
      .from('caption_corrections')
      .select('draft_text, final_text, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20)

    const rows = (data ?? []) as { draft_text: string | null; final_text: string | null; created_at: string | null }[]
    return seleccionarCorrecciones(
      rows.map((r) => ({ draftText: r.draft_text, finalText: r.final_text, recency: r.created_at })),
    )
  } catch {
    return []
  }
}
