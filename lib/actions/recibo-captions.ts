'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { generateIdeaCaption, saveIdeaCaption } from '@/lib/actions/idea-captions'
import { getAllSimpleProfiles } from '@/lib/metricool/client'
import { ideaTieneEditadoEntregas } from '@/lib/entregas/enviar-al-cliente'
import { planReciboCaption } from '@/lib/recibo/caption-plan'
import { matchMetricoolBlogId } from '@/lib/recibo/metricool-profile'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

/**
 * Write one Recibo caption in the voice of that client's published Metricool
 * posts. Does not schedule or publish anything.
 * Skips a video that already has a caption or a draft.
 */
export async function fillReciboCaption(
  ideaId: string,
  hermanos?: { titulo: string; caption: string }[],
): Promise<{ ok?: true; caption?: string; skipped?: boolean; error?: string }> {
  try {
    await requirePermission('captions.use')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!ideaId) return { error: 'Falta el video' }

  const supabase = await createClient()
  const { data: idea, error } = await supabase
    .from('content_ideas')
    .select(`
      id, title, hook, generated_caption, caption_draft, client_id,
      client:clients!content_ideas_client_id_fkey(id, name, metricool_blog_id),
      videos:content_idea_videos!content_idea_videos_idea_id_fkey(id, kind, status, storage_provider, drive_file_id)
    `)
    .eq('id', ideaId)
    .maybeSingle()

  if (error || !idea) return { error: error?.message || 'Video no encontrado' }

  const client = (Array.isArray(idea.client) ? idea.client[0] : idea.client) as {
    id?: string
    name?: string | null
    metricool_blog_id?: string | null
  } | null
  const videos = (idea.videos ?? []) as ContentIdeaVideo[]
  const storedBlog = client?.metricool_blog_id?.trim() || ''
  let matchedBlog: string | null = null
  if (!storedBlog) {
    const token = process.env.METRICOOL_TOKEN?.trim()
    const userId = process.env.METRICOOL_USER_ID?.trim()
    if (!token) return { error: 'Metricool no está configurado.' }
    try {
      const profiles = await getAllSimpleProfiles(token, userId)
      matchedBlog = matchMetricoolBlogId(client?.name ?? '', profiles)
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'No se pudo leer Metricool.' }
    }
  }

  const plan = planReciboCaption({
    title: idea.title,
    hook: idea.hook,
    generatedCaption: idea.generated_caption,
    captionDraft: idea.caption_draft,
    hasEdited: ideaTieneEditadoEntregas({ videos }),
    metricoolBlogId: storedBlog,
    matchedBlogId: matchedBlog,
  })

  if (plan.action === 'skip') return { ok: true, skipped: true, caption: plan.caption }
  if (plan.action === 'blocked') return { error: plan.error }

  if (plan.blogIdToSet && client?.id) {
    const { error: blogError } = await supabase
      .from('clients')
      .update({ metricool_blog_id: plan.blogIdToSet })
      .eq('id', client.id)
      .is('metricool_blog_id', null)
    if (blogError) return { error: blogError.message }
  }

  if (plan.hookToSet) {
    const { error: hookError } = await supabase
      .from('content_ideas')
      .update({ hook: plan.hookToSet })
      .eq('id', ideaId)
    if (hookError) return { error: hookError.message }
  }

  const generated = await generateIdeaCaption(ideaId, { hermanos })
  if (generated.error || !generated.caption) return { error: generated.error || 'La IA no devolvió caption' }

  const saved = await saveIdeaCaption(ideaId, generated.caption)
  if (saved.error) return { error: saved.error }

  revalidatePath('/recibo')
  return { ok: true, caption: generated.caption }
}
