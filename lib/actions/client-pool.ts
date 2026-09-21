'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas, requirePermission } from '@/lib/auth/server'
import { createDraftPost } from '@/lib/metricool/post'
import { checkVideoPlayable } from '@/lib/integrations/video-health'
import { r2PublicUrl } from '@/lib/integrations/r2'
import { entregasR2PublicUrl } from '@/lib/integrations/entregas-r2'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { resolvePlatforms, resolveVideoForPublish } from '@/lib/utils/idea-posting-core'
import { automaticPublishSchedule } from '@/lib/utils/automatic-publish-schedule'
import { resolveSlotTime } from '@/lib/utils/posting-schedule'
import { rangoSemana, diaDeFecha } from '@/lib/entregas/dias'
import { coverUrlForIdea } from '@/lib/pipeline/editor-history'
import {
  buildClientPoolPanel,
  canCreateMetricoolSchedule,
  canReschedulePoolIdea,
  metricoolDraftByIdea,
  poolPublishState,
  type ClientPoolPanel,
  type PoolClientInput,
  type PoolIdeaInput,
} from '@/lib/utils/client-pool-state'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

export type SchedulePoolResult = {
  ok?: true
  state?: 'agendado'
  draft?: true
  rescheduled?: boolean
  error?: string
}

function captionForSchedule(idea: {
  generated_caption?: string | null
  title?: string | null
  hook?: string | null
}): string {
  const caption = idea.generated_caption?.trim()
  if (caption) return caption
  return idea.title?.trim() || idea.hook?.trim() || ' '
}

function publicVideoUrl(video: { drive_file_id: string | null; storage_provider?: string | null }): string | null {
  if (!video.drive_file_id) return null
  return video.storage_provider === 'entregas-r2'
    ? entregasR2PublicUrl(video.drive_file_id)
    : r2PublicUrl(video.drive_file_id)
}

function coverVideoIdOf(videos: Array<{ id: string; kind?: string | null; status?: string | null }>): string | null {
  const edited = videos.find((v) => v.kind === 'edited' && v.status !== 'archived' && v.status !== 'failed')
  return edited?.id ?? videos.find((v) => v.status !== 'archived' && v.status !== 'failed')?.id ?? null
}

/**
 * Drag Listo → fecha: crea un BORRADOR en Metricool (blog_id del cliente).
 * Nunca autoPublish: el live se confirma en Metricool. Agendado → otra fecha:
 * solo mueve publish_date (sin segundo POST).
 */
export async function schedulePoolIdea(input: {
  ideaId: string
  date: string
}): Promise<SchedulePoolResult> {
  try {
    await requirePermission('posting.publish')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!input.ideaId) return { error: 'Falta el video' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'Fecha inválida' }

  const supabase = await createClient()
  const { data: idea, error: ideaErr } = await supabase
    .from('content_ideas')
    .select(
      'id, title, hook, content_type, generated_caption, status, published_at, publish_date, metricool_post_id, posted_at, manual_posted_status, staff_client_approval, client_review_status, approved_video_id, client_id, client:clients(id, edit_mode, metricool_blog_id, platforms, default_platforms, posting_time, posting_schedule)',
    )
    .eq('id', input.ideaId)
    .single()
  if (ideaErr || !idea) return { error: 'Idea no encontrada' }

  const client = (idea.client ?? {}) as {
    id?: string | null
    edit_mode?: 'ai' | 'human' | null
    metricool_blog_id?: string | null
    platforms?: string[] | null
    default_platforms?: string[] | null
    posting_time?: string | null
    posting_schedule?: Record<string, string> | null
  }
  const editMode = client.edit_mode ?? null
  const state = poolPublishState({
    status: idea.status as string | null,
    published_at: idea.published_at as string | null,
    manual_posted_status: (idea as { manual_posted_status?: string | null }).manual_posted_status ?? null,
    metricool_post_id: (idea.metricool_post_id as number | null) ?? null,
    posted_at: idea.posted_at as string | null,
    publish_date: idea.publish_date as string | null,
    staff_client_approval: (idea as { staff_client_approval?: string | null }).staff_client_approval ?? null,
    client_review_status: (idea as { client_review_status?: string | null }).client_review_status ?? null,
    client_edit_mode: editMode,
  })

  if (state === 'publicado') return { error: 'El video ya está publicado' }
  if (canReschedulePoolIdea(state)) {
    const { error } = await supabase
      .from('content_ideas')
      .update({ publish_date: input.date })
      .eq('id', input.ideaId)
    if (error) return { error: error.message }
    revalidatePoolPaths()
    return { ok: true, state: 'agendado', rescheduled: true }
  }
  if (!canCreateMetricoolSchedule(state, editMode)) {
    if (editMode !== 'ai') return { error: 'Solo el pool de Recibo (clientes AI) se agenda desde aquí' }
    return { error: 'El video tiene que estar Listo (aprobado en Recibo) para agendarlo' }
  }

  const blogId = client.metricool_blog_id?.trim()
  if (!blogId) return { error: 'El cliente no tiene Metricool configurado (falta blog_id)' }

  const { data: editedRows, error: editedErr } = await supabase
    .from('content_idea_videos')
    .select('id, idea_id, drive_file_id, storage_provider, kind, status, uploaded_at')
    .eq('idea_id', input.ideaId)
    .eq('kind', 'edited')
    .in('storage_provider', ['r2', 'entregas-r2'])
    .neq('status', 'archived')
  if (editedErr) return { error: `No se pudo leer el video editado: ${editedErr.message}` }

  const choice = resolveVideoForPublish(editedRows ?? [], {
    ideaId: input.ideaId,
    watchedOn: 'entregas',
    approvedVideoId: (idea as { approved_video_id?: string | null }).approved_video_id ?? null,
  })
  if (choice.skipped) return { error: choice.skipped }
  if (!choice.video) return { error: 'Falta el video editado' }

  const pubUrl = publicVideoUrl(choice.video)
  if (!pubUrl) return { error: 'No se pudo obtener la URL pública del video editado' }
  const health = await checkVideoPlayable(pubUrl)
  if (!health.ok) return { error: `El video no se puede reproducir desde su URL pública: ${health.reason}` }

  const dow = diaDeFecha(input.date)
  const slotTime = dow == null
    ? client.posting_time
    : resolveSlotTime(dow, client.posting_time, client.posting_schedule)
  const schedule = automaticPublishSchedule(input.date, slotTime)
  if (!schedule.ok) return { error: schedule.error }

  const platforms = resolvePlatforms(client.platforms, client.default_platforms)
  const caption = captionForSchedule(idea)

  const { data: claimed, error: claimErr } = await supabase
    .from('content_ideas')
    .update({ posting_started_at: new Date().toISOString() })
    .eq('id', input.ideaId)
    .is('metricool_post_id', null)
    .is('posted_at', null)
    .is('posting_started_at', null)
    .select('id')
  if (claimErr) return { error: claimErr.message }
  if (!claimed || claimed.length === 0) {
    return { error: 'El video ya está agendado o tiene un envío en curso' }
  }

  try {
    const res = await createDraftPost(
      caption,
      blogId,
      platforms,
      undefined,
      schedule.iso,
      {
        mediaUrls: [pubUrl],
        // autoPublish omitted → Metricool draft:true. Live is confirmed in Metricool.
        contentType: (idea.content_type as string | null) ?? null,
      },
    )
    const postId = res.data?.id ?? null
    const uuid = res.data?.uuid ?? null
    if (postId == null && !uuid) throw new Error('Metricool no devolvió un identificador de la publicación')

    const { error: recordErr } = await supabase
      .from('content_ideas')
      .update({
        publish_date: input.date,
        metricool_post_id: postId,
        metricool_uuid: uuid,
        posted_at: new Date().toISOString(),
        posting_error: null,
        posting_started_at: null,
      })
      .eq('id', input.ideaId)
    if (recordErr) {
      return {
        error: `Metricool creó la publicación ${postId ?? uuid}, pero no se pudo guardar en el dashboard.`,
      }
    }

    await logIdeaActivity(supabase, {
      ideaId: input.ideaId,
      action: 'posted_to_metricool',
      clientId: (idea.client_id as string | null) ?? client.id ?? null,
      metadata: {
        source: 'client_panel',
        scheduledFor: schedule.iso,
        metricoolPostId: postId,
        platforms,
        draft: true,
        autoPublish: false,
      },
    })
    revalidatePoolPaths()
    return { ok: true, state: 'agendado', draft: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al publicar en Metricool'
    const definitelyNotCreated = err instanceof Error && 'definitelyNotCreated' in err && err.definitelyNotCreated === true
    if (definitelyNotCreated) {
      await supabase
        .from('content_ideas')
        .update({ posting_started_at: null, posting_error: msg })
        .eq('id', input.ideaId)
      return { error: msg }
    }
    await supabase.from('content_ideas').update({ posting_error: msg }).eq('id', input.ideaId)
    return { error: `No se pudo confirmar el resultado del envío. Debes verificarlo en Metricool antes de reenviar. ${msg}` }
  }
}

function revalidatePoolPaths() {
  revalidatePath('/pool')
  revalidatePath('/calendar')
  revalidatePath('/recibo')
  revalidatePath('/entregas')
}

export async function getClientPoolPanel(): Promise<{ data?: ClientPoolPanel; error?: string }> {
  try {
    await requirePermission('posting.read')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const week = rangoSemana(new Date(), 0)

  const [clientsRes, ideasRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, logo_url, posting_days, posting_time, posting_schedule, metricool_blog_id, edit_mode')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('content_ideas')
      .select(`
        id, client_id, title, hook, status, publish_date, published_at,
        manual_posted_status, metricool_post_id, posted_at,
        staff_client_approval, client_review_status, generated_caption,
        videos:content_idea_videos!content_idea_videos_idea_id_fkey(
          id, kind, status, drive_thumb_url, drive_file_id, storage_provider, thumb_keys, uploaded_at
        )
      `)
      .neq('status', 'descartada'),
  ])
  if (clientsRes.error) return { error: clientsRes.error.message }
  if (ideasRes.error) return { error: ideasRes.error.message }

  const ideas = (ideasRes.data ?? []) as Array<Record<string, unknown> & { id: string; videos?: unknown[] }>
  const ideaIds = ideas.map((i) => i.id)
  const reviewByIdea: Record<string, string> = {}
  let draftByIdea: Record<string, boolean> = {}
  if (ideaIds.length > 0) {
    const [reviews, drafts] = await Promise.all([
      supabase
        .from('entregas_client_review_items')
        .select('idea_id, status, decided_at')
        .in('idea_id', ideaIds)
        .order('decided_at', { ascending: false }),
      supabase
        .from('content_idea_activity')
        .select('content_idea_id, metadata, created_at')
        .eq('action', 'posted_to_metricool')
        .in('content_idea_id', ideaIds)
        .order('created_at', { ascending: false }),
    ])
    for (const row of reviews.data ?? []) {
      const id = row.idea_id as string
      if (reviewByIdea[id]) continue
      reviewByIdea[id] = row.status as string
    }
    draftByIdea = metricoolDraftByIdea(
      (drafts.data ?? []) as Array<{ content_idea_id?: string | null; metadata?: Record<string, unknown> | null }>,
    )
  }

  const clients: PoolClientInput[] = (clientsRes.data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    logo_url: (c as { logo_url?: string | null }).logo_url ?? null,
    posting_days: (c.posting_days ?? []) as number[],
    posting_time: c.posting_time ?? null,
    posting_schedule: (c.posting_schedule ?? null) as Record<string, string> | null,
    metricool_blog_id: c.metricool_blog_id ?? null,
    edit_mode: ((c as { edit_mode?: 'ai' | 'human' | null }).edit_mode ?? 'human') as 'ai' | 'human',
  }))

  const ideaRows: PoolIdeaInput[] = ideas.map((raw) => {
    const videos = (raw.videos ?? []) as IdeaWithPipeline['videos']
    return {
      id: raw.id,
      client_id: raw.client_id as string,
      title: (raw.title as string) ?? '',
      hook: (raw.hook as string | null) ?? null,
      status: raw.status as string,
      publish_date: (raw.publish_date as string | null) ?? null,
      published_at: (raw.published_at as string | null) ?? null,
      manual_posted_status: (raw.manual_posted_status as PoolIdeaInput['manual_posted_status']) ?? null,
      metricool_post_id: (raw.metricool_post_id as number | null) ?? null,
      posted_at: (raw.posted_at as string | null) ?? null,
      staff_client_approval: (raw.staff_client_approval as string | null) ?? null,
      client_review_status: (raw.client_review_status as string | null) ?? null,
      generated_caption: (raw.generated_caption as string | null) ?? null,
      coverVideoId: coverVideoIdOf(videos ?? []),
      coverUrl: coverUrlForIdea({ videos } as IdeaWithPipeline),
      metricoolDraft: draftByIdea[raw.id] === true,
    }
  })

  return { data: buildClientPoolPanel({ clients, ideas: ideaRows, reviewByIdea, week }) }
}

export async function canScheduleFromPool(): Promise<boolean> {
  return currentUserHas('posting.publish')
}
