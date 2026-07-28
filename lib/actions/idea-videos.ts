'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { isDriveConfigured } from '@/lib/integrations/google-drive'
import type { ContentIdeaVideo, ContentIdeaVideoKind } from '@/lib/supabase/types'
import { logIdeaActivity } from '@/lib/utils/idea-activity'

export async function getIdeaVideos(ideaId: string): Promise<ContentIdeaVideo[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_idea_videos')
    .select('*')
    .eq('idea_id', ideaId)
    .neq('status', 'archived')
    .order('uploaded_at', { ascending: false })
  if (error) return []
  return (data ?? []) as ContentIdeaVideo[]
}

/**
 * Called by the client after a successful Drive upload to record metadata.
 * The actual upload happens browser-side (resumable to Drive) to keep the
 * server out of the data path.
 */
export async function registerIdeaVideo(input: {
  ideaId: string
  kind: ContentIdeaVideoKind
  name: string
  driveFileId: string
  driveViewLink: string | null
  driveThumbUrl?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  durationSec?: number | null
  notes?: string | null
}): Promise<{ ok?: true; id?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Archive previous active video of same kind for this idea
  await supabase
    .from('content_idea_videos')
    .update({ status: 'archived' })
    .eq('idea_id', input.ideaId)
    .eq('kind', input.kind)
    .eq('status', 'uploaded')

  const { data, error } = await supabase
    .from('content_idea_videos')
    .insert({
      idea_id: input.ideaId,
      kind: input.kind,
      name: input.name,
      drive_file_id: input.driveFileId,
      drive_view_link: input.driveViewLink,
      drive_thumb_url: input.driveThumbUrl ?? null,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes ?? null,
      duration_sec: input.durationSec ?? null,
      notes: input.notes ?? null,
      uploaded_by: user?.id ?? null,
      status: 'uploaded',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  // Auto-advance the idea status when raw arrives
  if (input.kind === 'raw') {
    await supabase
      .from('content_ideas')
      .update({ status: 'grabada' })
      .eq('id', input.ideaId)
      .in('status', ['idea', 'asignada'])
  }
  // 'edited' upload does NOT auto-advance — that happens after QC approves.

  await logIdeaActivity(supabase, {
    ideaId: input.ideaId,
    userId: user?.id ?? null,
    action: 'video_uploaded',
    metadata: { kind: input.kind, name: input.name },
  })

  revalidatePath('/planning')
  revalidatePath(`/produccion`)
  return { ok: true, id: data.id }
}

export async function deleteIdeaVideo(id: string): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createClient()
  // Soft delete — keep audit trail; archived rows are filtered out in queries.
  const { error } = await supabase
    .from('content_idea_videos')
    .update({ status: 'archived' })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/planning')
  return { ok: true }
}

/**
 * The browser asks for an upload slot. Returns either a signed resumable URL
 * pointing to Google Drive (when Drive is configured) or an error explaining
 * what's missing.
 *
 * Stubbed until the user picks the auth mode — see `lib/integrations/google-drive.ts`.
 */
/**
 * Manual mode: the user already uploaded the file to Drive on their own and
 * pastes the share link. We extract the file_id and persist a normalized
 * viewLink + thumbnail URL. Works today, no Drive auth needed.
 */
export async function registerIdeaVideoFromLink(input: {
  ideaId: string
  kind: ContentIdeaVideoKind
  driveLink: string
  name?: string
  notes?: string
}): Promise<{ ok?: true; id?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const fileId = parseDriveFileId(input.driveLink)
  if (!fileId) {
    return { error: 'No se pudo extraer el file ID del link. Pega el link de Drive completo o el ID directamente.' }
  }

  const viewLink = `https://drive.google.com/file/d/${fileId}/view`
  const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`
  const name = input.name?.trim() || `Video ${input.kind === 'raw' ? 'crudo' : 'editado'} ${new Date().toLocaleDateString('es-PR')}`

  return registerIdeaVideo({
    ideaId: input.ideaId,
    kind: input.kind,
    name,
    driveFileId: fileId,
    driveViewLink: viewLink,
    driveThumbUrl: thumbUrl,
    notes: input.notes ?? null,
  })
}

/**
 * Accepts:
 *   - https://drive.google.com/file/d/<ID>/view?usp=sharing
 *   - https://drive.google.com/open?id=<ID>
 *   - https://drive.google.com/uc?id=<ID>&export=download
 *   - the bare 25–60 char file ID
 */
function parseDriveFileId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // file/d/<id>/
  const m1 = trimmed.match(/\/file\/d\/([A-Za-z0-9_-]{15,})/)
  if (m1) return m1[1]
  // ?id=<id>
  const m2 = trimmed.match(/[?&]id=([A-Za-z0-9_-]{15,})/)
  if (m2) return m2[1]
  // Bare ID (no slashes, plausible length)
  if (/^[A-Za-z0-9_-]{15,}$/.test(trimmed) && !trimmed.includes('/')) return trimmed
  return null
}

export async function startDriveUpload(input: {
  ideaId: string
  kind: ContentIdeaVideoKind
  fileName: string
  mimeType: string
  sizeBytes: number
}): Promise<{ uploadUrl?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  if (!isDriveConfigured()) {
    return {
      error:
        'Google Drive aún no está configurado en este entorno. ' +
        'Añade GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_KEY + GDRIVE_ROOT_FOLDER_ID a .env.local ' +
        '(o el flujo OAuth) y vuelve a intentar. Mientras tanto, sube manualmente a tu Drive y pega el file ID.',
    }
  }

  // TODO: real implementation — pick mode, mint token, init resumable session.
  void input
  return { error: 'Drive configurado pero la integración nativa aún no está terminada. Usa el modo "Pegar Drive file ID".' }
}
