'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import {
  recordedEntryFields,
  isRecordedEntryStage,
  type RecordedEntryStage,
} from '@/lib/utils/recorded-entry'
import type { ContentIdeaType } from '@/lib/supabase/types'

const MAX_RAW = 5

export interface CreateRecordedVideoInput {
  clientId: string
  title: string
  /** Default 'R' (Reel). */
  contentType?: ContentIdeaType
  /** Which post-recording column the video enters. */
  entryStage: RecordedEntryStage
  /** Optional caption (the Caption stage is skipped, but it can be filled now). */
  caption?: string | null
  /** Drive links for the raw footage — up to 5 per video. */
  rawLinks?: string[]
  /** Drive link for the finished, edited cut. */
  editedLink?: string | null
  /** Person who owns the batch (drives the card color). */
  assigneeId?: string | null
}

const clean = (s?: string | null) => (s ?? '').trim()
const cleanLinks = (links?: string[]) => (links ?? []).map(clean).filter((l) => l.length > 0)

/**
 * Intake for an already-recorded video: skips Idea/Title/Caption and drops the
 * card straight into the chosen column (Video / Edited / Approval), attaching
 * its raw footage (up to 5 clips) and the edited cut as Drive links. The videos
 * live on content_idea_videos keyed by idea_id, so the card carries them as it
 * moves through the pipeline.
 */
export async function createRecordedVideo(
  input: CreateRecordedVideoInput,
): Promise<{ ideaId?: string; error?: string }> {
  try {
    await requirePermission('planning.intake')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const title = clean(input.title)
  const clientId = clean(input.clientId)
  if (!clientId) return { error: 'Selecciona un cliente.' }
  if (!title) return { error: 'El título es obligatorio.' }
  if (!isRecordedEntryStage(input.entryStage)) {
    return { error: 'Columna de entrada inválida.' }
  }

  const rawLinks = cleanLinks(input.rawLinks)
  if (rawLinks.length > MAX_RAW) {
    return { error: `Máximo ${MAX_RAW} videos raw por video.` }
  }
  const editedLink = clean(input.editedLink)
  const caption = clean(input.caption)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: idea, error: ideaErr } = await supabase
    .from('content_ideas')
    .insert({
      client_id: clientId,
      content_type: input.contentType ?? 'R',
      title,
      ...recordedEntryFields(input.entryStage),
      generated_caption: caption || null,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (ideaErr || !idea) return { error: ideaErr?.message ?? 'No se pudo crear el video.' }
  const ideaId = (idea as { id: string }).id

  const videoRows = [
    ...rawLinks.map((link, i) => ({
      idea_id: ideaId,
      kind: 'raw' as const,
      name: `${title} — raw ${i + 1}`,
      drive_view_link: link,
      uploaded_by: user?.id ?? null,
      status: 'uploaded' as const,
    })),
    ...(editedLink
      ? [{
          idea_id: ideaId,
          kind: 'edited' as const,
          name: `${title} — editado`,
          drive_view_link: editedLink,
          uploaded_by: user?.id ?? null,
          status: 'uploaded' as const,
        }]
      : []),
  ]

  if (videoRows.length > 0) {
    const { error: vidErr } = await supabase.from('content_idea_videos').insert(videoRows)
    if (vidErr) return { error: vidErr.message }
  }

  // Assignee drives the card color. The board reads it from the idea's
  // production task, so link one (today's date as a movable default) WITHOUT
  // touching the entry status — the card must stay in its chosen column.
  const assigneeId = clean(input.assigneeId)
  if (assigneeId) {
    const { data: task, error: taskErr } = await supabase
      .from('production_tasks')
      .insert({
        client_id: clientId,
        content_type: (input.contentType ?? 'R') === 'R' ? 'R' : 'P',
        publish_date: new Date().toISOString().slice(0, 10),
        assigned_to_id: assigneeId,
        status: 'pendiente',
        idea_id: ideaId,
        created_by: user?.id ?? null,
      })
      .select()
      .single()
    if (!taskErr && task) {
      await supabase
        .from('content_ideas')
        .update({ production_task_id: (task as { id: string }).id })
        .eq('id', ideaId)
    }
  }

  await logIdeaActivity(supabase, {
    ideaId,
    action: 'status_changed',
    metadata: { intake: 'recorded', entryStage: input.entryStage, raw: rawLinks.length, edited: editedLink ? 1 : 0 },
  })

  revalidatePath('/pipeline')
  revalidatePath('/planning')
  revalidatePath(`/clients/${clientId}`)
  return { ideaId }
}
