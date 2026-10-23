'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { huboCambioSignificativo } from '@/lib/utils/caption-corrections'
import { hasCaptionableVideo } from '@/lib/utils/idea-ready'
import { displayCaptionDraft } from '@/lib/utils/caption-draft'
import { generateIdeaCaptionWithClient } from '@/lib/pipeline/idea-caption-generate'

const filled = (s?: string | null): boolean => !!s && s.trim().length > 0

export async function generateIdeaCaption(
  ideaId: string,
  opts?: {
    feedback?: string | null
    previousCaption?: string | null
    auto?: boolean
    hermanos?: { titulo: string; caption: string }[]
    videoId?: string | null
    primerRoundKind?: 'live' | 'gfx' | null
  },
): Promise<{ ok?: true; caption?: string; error?: string }> {
  try {
    await requirePermission('captions.use')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createClient()
  return generateIdeaCaptionWithClient(supabase, ideaId, opts)
}

/**
 * Promote the caption a human settled on: it becomes `generated_caption` (the
 * field the pipeline reads) and the draft is cleared so no stale AI text is
 * left behind to reappear later.
 *
 * This — not generation — is what moves an approved video to Publicación.
 */
export async function saveIdeaCaption(
  ideaId: string,
  caption: string,
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('captions.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  // An empty save would clear `generated_caption` and silently drag the video
  // back from Publicación to Copy — refuse instead.
  const clean = caption.trim()
  if (!clean) return { error: 'El caption no puede ir vacío' }

  const supabase = await createClient()
  const { data: vids } = await supabase
    .from('content_idea_videos')
    .select('id, status')
    .eq('idea_id', ideaId)
    .neq('status', 'archived')
    .limit(1)
  if (!hasCaptionableVideo(vids)) {
    return { error: 'Sube un video antes de guardar el caption.' }
  }

  // Pieza 3: aprendizaje por corrección, POR CLIENTE — si hay un borrador y el
  // equipo lo cambió de verdad antes de guardar, esa diferencia es la señal
  // más valiosa que hay. Best-effort y ANTES de limpiar caption_draft abajo,
  // porque una vez limpio el borrador original se pierde para siempre.
  // Degrada seguro sin la migración 0066 (tabla inexistente → catch, sigue).
  try {
    const { data: current } = await supabase
      .from('content_ideas')
      .select('client_id, caption_draft')
      .eq('id', ideaId)
      .single()
    const draft = displayCaptionDraft((current as { caption_draft?: string | null } | null)?.caption_draft)
    const clientIdForCorrection = (current as { client_id?: string | null } | null)?.client_id
    if (filled(draft) && clientIdForCorrection && huboCambioSignificativo(draft, clean)) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      await supabase.from('caption_corrections').insert({
        client_id: clientIdForCorrection,
        idea_id: ideaId,
        draft_text: draft,
        final_text: clean,
        corrected_by: user?.id ?? null,
      })
    }
  } catch {
    // best-effort — never block saving the caption over this
  }

  const { error } = await supabase
    .from('content_ideas')
    .update({
      generated_caption: clean,
      caption_draft: null,
      caption_platform: null,
      caption_generated_at: new Date().toISOString(),
    })
    .eq('id', ideaId)
  if (error) return { error: error.message }

  await logIdeaActivity(supabase, { ideaId, action: 'caption_saved', metadata: {} })

  revalidatePath(`/produccion/idea/${ideaId}`)
  revalidatePath('/planning')
  revalidatePath('/pipeline')
  return { ok: true }
}
