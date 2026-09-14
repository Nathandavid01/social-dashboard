/** Standing style notes Eric taught for Primer Round Reels (this client + this format). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { PRIMER_ROUND_CLIENT_ID } from './constants'

export const PRIMER_ROUND_STYLE_RULES_LIMIT = 8

/** Standing notes for GFX / promo Reels (not show clips). */
export const PRIMER_ROUND_GFX_STYLE_RULES = [
  'Reel gráfico / promo (GFX), no un clip del programa: no lo escribas como corte de entrevista.',
  'El gancho es la frase principal del overlay (ej. LA NOTICIA NO ESPERA), no juntas todas las preguntas de pantalla.',
  'No repitas el gancho en la línea 3. Si el hook es LA NOTICIA NO ESPERA, la siguiente oración empieza por el horario.',
  'En este tipo de Reel no pongas “Episodio completo en YouTube”.',
  'Frase de Facebook: “Mañana desde las 5:43 AM junto a Rafael Lenín López y Dennise Pérez.” Hoy / el lunes según el aire. Domingo publicado hoy = Mañana.',
]

/** Newest-first notes → unique short rules. Splits caption_notes bullets. */
export function collectPrimerRoundStyleRules(
  notes: Array<string | null | undefined>,
  limit = PRIMER_ROUND_STYLE_RULES_LIMIT,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of notes) {
    const chunks = (raw ?? '')
      .split(/\n+/)
      .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
      .filter((line) => line.length >= 3)
    for (const part of chunks) {
      const key = part.toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(part)
      if (out.length >= limit) return out
    }
  }
  return out
}

export function formatPrimerRoundStyleRulesBlock(rules: string[]): string {
  const kept = collectPrimerRoundStyleRules(rules)
  if (kept.length === 0) return ''
  return `ESTILO DE LOS REELS DE PRIMER ROUND (Eric lo enseñó para este cliente y este tipo de video; aplícalo SIEMPRE, no solo en este Reel):\n${kept
    .map((rule) => `- ${rule}`)
    .join('\n')}`
}

export async function loadPrimerRoundStyleRules(supabase: SupabaseClient): Promise<string[]> {
  const [notesRes, clientRes] = await Promise.all([
    supabase
      .from('caption_feedback')
      .select('note')
      .eq('client_id', PRIMER_ROUND_CLIENT_ID)
      .not('note', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('clients').select('caption_notes').eq('id', PRIMER_ROUND_CLIENT_ID).maybeSingle(),
  ])
  const notes = (notesRes.data ?? []).map((row) => (row as { note?: string | null }).note)
  const captionNotes = (clientRes.data as { caption_notes?: string | null } | null)?.caption_notes
  return collectPrimerRoundStyleRules([...PRIMER_ROUND_GFX_STYLE_RULES, ...notes, captionNotes])
}
