'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, currentUserHas } from '@/lib/auth/server'
import { notifyReviewChange } from '@/lib/utils/review-notification'
import { applyReviewDecision } from '@/lib/utils/internal-review'
import { reviewQualityError, type ReviewVerification } from '@/lib/utils/review-quality'
import type { ContentIdea, IdeaApprovalStatus } from '@/lib/supabase/types'

/**
 * Persistence for the pipeline board.
 *
 * The submit flow is two steps on purpose: the idea row must exist before a
 * video can be attached to it (getR2UploadUrl keys the object under the idea
 * id). So the client calls createSubmittedIdea, then presigns, PUTs the file
 * and calls registerR2Video — in that order.
 */

export async function createSubmittedIdea(input: {
  clientId: string
  title: string
  /** "De qué es el video" — the only field the caption AI requires. */
  hook?: string | null
  /** YYYY-MM-DD del día para el que se entrega. */
  publishDate?: string | null
  /**
   * Optional Drive reference for the reviewer. content_ideas has no free-text
   * column for it (verified against the live schema), so it rides in
   * visual_brief — the field the reviewer already reads — clearly labelled.
   * The published media always comes from R2, never from this link.
   */
  driveLink?: string | null
}): Promise<{ idea?: ContentIdea; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  if (!input.clientId) return { error: 'Falta el cliente' }
  const title = input.title?.trim()
  if (!title) return { error: 'Falta el título del video' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('content_ideas')
    .insert({
      client_id: input.clientId,
      content_type: 'R',
      title,
      hook: input.hook?.trim() || null,
      // The editor is delivering an edited video, so the row enters the board
      // already produced and waiting on a reviewer.
      status: 'producida',
      approval_status: 'submitted' satisfies IdeaApprovalStatus,
      submitted_at: new Date().toISOString(),
      publish_date: input.publishDate || null,
      created_by: user?.id ?? null,
      visual_brief: input.driveLink?.trim()
        ? `Referencia en Drive: ${input.driveLink.trim()}`
        : null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/mi-dia')
  revalidatePath('/revision')
  revalidatePath('/entregas')
  revalidatePath('/pipeline')
  return { idea: data as ContentIdea }
}

/**
 * Record a reviewer's decision. Re-reads the current status server-side and
 * runs it through applyReviewDecision, so a stale board can't approve a video
 * that someone else already sent back.
 */
export async function decideReview(input: {
  ideaId: string
  decision: 'approve' | 'request_changes'
  note?: string
} & ReviewVerification): Promise<{ ok?: true; status?: IdeaApprovalStatus; warning?: string; error?: string }> {
  try {
    await requirePermission('video.approve')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const qualityError = reviewQualityError(input)
  if (qualityError) return { error: qualityError }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: idea, error: readErr } = await supabase
    .from('content_ideas')
    .select('id, title, approval_status, created_by, metricool_post_id, posted_at, client:clients(assigned_to), production_task:production_tasks!content_ideas_production_task_id_fkey(assigned_to_id)')
    .eq('id', input.ideaId)
    .single()
  if (readErr || !idea) return { error: 'Video no encontrado' }

  if (idea.metricool_post_id || idea.posted_at) return { error: 'Este video ya fue enviado a Metricool. Verifica la agenda antes de cambiarlo.' }

  const next = applyReviewDecision(idea.approval_status as IdeaApprovalStatus, input.decision)
  if (!next) return { error: 'Este video ya no está en revisión.' }

  if (input.videoFileId) {
    const { data: file, error: fileError } = await supabase.from('content_idea_videos')
      .select('id,uploaded_by').eq('id', input.videoFileId!).eq('idea_id', input.ideaId)
      .eq('kind', 'edited').eq('storage_provider', 'entregas-r2')
      .not('status', 'in', '(archived,failed)').maybeSingle()
    if (fileError || !file) return { error: 'El archivo revisado ya no está disponible. Abre la revisión de nuevo.' }
    if ((file.uploaded_by ?? idea.created_by) === user?.id) return { error: 'No puedes revisar tu propio video.' }
  }
  // Store feedback first: never send an editor back without the correction text.
  const { error: historyError } = await supabase.from('content_idea_activity').insert({
    content_idea_id: input.ideaId, user_id: user?.id ?? null,
    action: next === 'approved' ? 'review_verified' : 'changes_requested',
    metadata: { note: input.note?.trim() ?? '', videoFileId: input.videoFileId ?? null,
      captionsVerified: next === 'approved', videoVerified: next === 'approved' },
  })
  if (historyError) return { error: 'No se pudo guardar la revisión. El video sigue pendiente; intenta otra vez.' }
  const { data: changed, error } = await supabase
    .from('content_ideas')
    .update({
      approved_video_id: next === 'approved' ? input.videoFileId : null,
      approval_status: next,
      approved_by: next === 'approved' ? user?.id ?? null : null,
      approved_at: next === 'approved' ? new Date().toISOString() : null,
    })
    .eq('id', input.ideaId).eq('approval_status','submitted').select('id').maybeSingle()
  if (error || !changed) return { error: error?.message ?? 'Otro revisor cambió el estado. Actualiza antes de continuar.' }

  revalidatePath('/mi-dia')
  revalidatePath('/revision')
  revalidatePath('/entregas')
  revalidatePath('/pipeline')
  revalidatePath('/revision')
  revalidatePath('/entregas')
  const client = idea.client as unknown as {assigned_to?:string}|null
  const task = idea.production_task as unknown as {assigned_to_id?:string}|null
  const warning = await notifyReviewChange(supabase,{ideaId:input.ideaId,title:idea.title || 'Video',editorId:task?.assigned_to_id ?? client?.assigned_to ?? idea.created_by,actorId:user?.id,outcome:next as 'approved'|'revision_needed',note:input.note})
  return { ok: true, status: next, ...(warning ? {warning} : {}) }
}

/** The editor resubmits after fixing what the reviewer asked for. */
export async function resubmitForReview(ideaId: string): Promise<{ ok?: true; warning?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: idea } = await supabase
    .from('content_ideas')
    .select('title, approval_status, status, metricool_post_id, posted_at, posting_started_at, created_by, client:clients(assigned_to), production_task:production_tasks!content_ideas_production_task_id_fkey(assigned_to_id)')
    .eq('id', ideaId)
    .single()
  if (!idea) return { error: 'Video no encontrado' }
  if (idea.metricool_post_id != null || idea.posted_at || idea.posting_started_at || ['publicada','descartada'].includes(idea.status)) {
    return { error: 'Este video ya fue enviado, está en verificación de envío o fue cerrado. Actualiza antes de reenviar.' }
  }


  const { data: { user } } = await supabase.auth.getUser()
  const client = idea.client as unknown as {assigned_to?:string}|null
  const task = idea.production_task as unknown as {assigned_to_id?:string}|null
  const ownerId = task?.assigned_to_id ?? client?.assigned_to ?? idea.created_by
  if (!user || (ownerId !== user.id && !await currentUserHas('video.approve'))) return { error: 'Solo el editor asignado puede reenviar este video.' }
  const { data: files, error: filesError } = await supabase.from('content_idea_videos')
    .select('id,uploaded_at').eq('idea_id', ideaId).eq('kind','edited').eq('storage_provider','entregas-r2')
    .not('status','in','(archived,failed)').order('uploaded_at',{ascending:false}).limit(1)
  if (filesError || !files?.length) return { error: 'Sube el archivo editado corregido antes de enviarlo a revisión.' }
  const { data: changes, error: changesError } = await supabase.from('content_idea_activity')
    .select('created_at').eq('content_idea_id',ideaId).in('action',['changes_requested','client_requested_changes']).order('created_at',{ascending:false}).limit(1)
  if (changesError) return { error: 'No se pudo comprobar la última corrección.' }
  if (changes?.[0] && files[0].uploaded_at <= changes[0].created_at) return { error: 'Sube una nueva versión que atienda los comentarios antes de reenviar.' }
  const next = applyReviewDecision(idea.approval_status as IdeaApprovalStatus, 'submit')
  if (!next) return { error: 'Este video no está esperando cambios.' }

  const { data: changed, error } = await supabase
    .from('content_ideas')
    .update({ approved_video_id: null, approved_at: null, approved_by: null, approval_status: next, submitted_at: new Date().toISOString() })
    .eq('id', ideaId)
    .eq('approval_status', idea.approval_status)
    .is('metricool_post_id', null).is('posted_at', null).is('posting_started_at', null)
    .not('status', 'in', '(publicada,descartada)')
    .select('id').maybeSingle()
  if (error || !changed) return { error: error?.message ?? 'El video cambió mientras trabajabas. Actualiza antes de reenviar.' }

  revalidatePath('/mi-dia')
  revalidatePath('/revision')
  revalidatePath('/entregas')
  revalidatePath('/pipeline')
  const warning = await notifyReviewChange(supabase,{ideaId,title:idea.title || 'Video',editorId:ownerId,actorId:user.id,outcome:'submitted'})
  return { ok: true, ...(warning ? {warning} : {}) }
}


/**
 * The browser reports why an upload died. A CORS block or a network drop never
 * reaches the server on its own — the PUT goes straight to R2 — so without this
 * the failure is invisible in the logs and only the user sees it.
 */
export async function reportUploadFailure(detail: string): Promise<void> {
  console.error('[subida fallida]', detail)
}

/**
 * Take a batch off the board.
 *
 * Marks the rows `descartada` instead of deleting them: the board already
 * excludes that status everywhere, so the card disappears exactly as a delete
 * would — but the video, its copy and its history survive. An X on a card is
 * one misclick away, and a misclick shouldn't destroy an editor's work.
 */
export async function discardEntregaVideos(
  ideaIds: string[],
): Promise<{ ok?: true; count?: number; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (ideaIds.length === 0) return { error: 'Nada que descartar' }

  const supabase = await createClient()
  const ids = [...new Set(ideaIds)]
  // Apply the delivery guard in the write itself: a concurrent sender may
  // have claimed a video after the board was rendered.
  const { data, error } = await supabase
    .from('content_ideas')
    .update({ status: 'descartada' })
    .in('id', ids)
    .is('metricool_post_id', null)
    .is('posting_started_at', null)
    .is('posted_at', null)
    .is('published_at', null)
    .not('status', 'in', '(publicada,descartada)')
    .select('id')
  if (error) return { error: error.message }

  const count = data?.length ?? 0
  revalidatePath('/entregas')
  revalidatePath('/mi-dia')
  revalidatePath('/revision')
  revalidatePath('/pipeline')
  if (count !== ids.length) return {
    count,
    error: `Se quitaron ${count} de ${ids.length} videos. Los demás no se cambiaron: pueden tener un envío en curso, estar agendados, publicados o haber cambiado de estado. Actualiza y verifica Metricool.`,
  }
  return { ok: true, count }
}

/** Existing approvals without caption verification must return to the reviewer. */
export async function reopenReviewForVerification(ideaId:string):Promise<{ok?:true;error?:string}> {
 try {await requirePermission('video.approve')} catch {return {error:'No autorizado'}}
 const db=await createClient()
 const {data,error}=await db.from('content_ideas').update({approval_status:'submitted',approved_video_id:null,approved_at:null,approved_by:null,submitted_at:new Date().toISOString()})
  .eq('id',ideaId).eq('approval_status','approved').is('metricool_post_id',null).is('posted_at',null).is('published_at',null).is('posting_started_at',null).not('status','in','(publicada,descartada)').select('id').maybeSingle()
 if(error||!data)return {error:'No se pudo reabrir. Hay un envío en curso o pendiente de verificar, ya se envió a Metricool o el video cambió de estado.'}
 revalidatePath('/mi-dia');revalidatePath('/revision');revalidatePath('/entregas')
 return {ok:true}
}

export async function checkCorrectionOwner(ideaId:string):Promise<{ok?:true;error?:string}>{
 try{await requirePermission('video.upload')}catch{return {error:'No autorizado'}}
 const db=await createClient(),{data:{user}}=await db.auth.getUser()
 if(!user)return {error:'No autorizado'}
 const {data:idea,error}=await db.from('content_ideas').select('created_by,approval_status,client:clients(assigned_to),production_task:production_tasks!content_ideas_production_task_id_fkey(assigned_to_id)').eq('id',ideaId).single()
 if(error||!idea||idea.approval_status!=='revision_needed')return {error:'Este video ya no está esperando correcciones.'}
 const client=idea.client as unknown as {assigned_to?:string}|null,task=idea.production_task as unknown as {assigned_to_id?:string}|null
 if((task?.assigned_to_id??client?.assigned_to??idea.created_by)!==user.id&&!await currentUserHas('video.approve'))return {error:'Esta corrección pertenece a otro editor.'}
 return {ok:true}
}
