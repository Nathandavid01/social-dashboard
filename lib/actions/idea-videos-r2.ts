'use server'

import { revalidatePath } from 'next/cache'
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { r2Client, r2Bucket, isR2Configured } from '@/lib/integrations/r2'
import type { ContentIdeaVideoKind } from '@/lib/supabase/types'

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

/**
 * Mint a presigned PUT URL so the browser uploads the file straight to R2.
 * Returns the URL + the object key to register afterwards.
 */
export async function getR2UploadUrl(input: {
  ideaId: string
  kind: ContentIdeaVideoKind
  fileName: string
  contentType: string
}): Promise<{ url?: string; key?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const client = r2Client()
  if (!client || !isR2Configured()) return { error: 'R2 no está configurado' }

  const key = `ideas/${input.ideaId}/${input.kind}/${Date.now()}-${slugify(input.fileName)}`
  try {
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: r2Bucket(), Key: key, ContentType: input.contentType }),
      { expiresIn: 60 * 60 }, // 1h to complete the upload
    )
    return { url, key }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error generando URL de subida' }
  }
}

/**
 * After the browser finishes the PUT, record the video row.
 * Archives any previous active video of the same kind (except b-rolls, which
 * accumulate).
 */
export async function registerR2Video(input: {
  ideaId: string
  kind: ContentIdeaVideoKind
  key: string
  name: string
  sizeBytes: number
  mimeType: string
  notes?: string | null
}): Promise<{ ok?: true; id?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (input.kind !== 'broll') {
    await supabase
      .from('content_idea_videos')
      .update({ status: 'archived' })
      .eq('idea_id', input.ideaId)
      .eq('kind', input.kind)
      .eq('status', 'uploaded')
  }

  const { data, error } = await supabase
    .from('content_idea_videos')
    .insert({
      idea_id: input.ideaId,
      kind: input.kind,
      name: input.name,
      drive_file_id: input.key,        // R2 object key
      storage_provider: 'r2',
      size_bytes: input.sizeBytes,
      mime_type: input.mimeType,
      notes: input.notes ?? null,
      uploaded_by: user?.id ?? null,
      status: 'uploaded',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  if (input.kind === 'raw') {
    await supabase.from('content_ideas').update({ status: 'grabada' })
      .eq('id', input.ideaId).in('status', ['idea', 'asignada'])
  }

  await logIdeaActivity(supabase, {
    ideaId: input.ideaId,
    userId: user?.id ?? null,
    action: 'video_uploaded',
    metadata: { kind: input.kind, name: input.name, provider: 'r2' },
  })

  revalidatePath(`/produccion/idea/${input.ideaId}`)
  revalidatePath('/ideacion')
  return { ok: true, id: data.id }
}

/** Presigned GET URL so an editor downloads straight from R2 (fast, CDN). */
export async function getR2DownloadUrl(videoId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: video, error } = await supabase
    .from('content_idea_videos')
    .select('drive_file_id, storage_provider, name')
    .eq('id', videoId)
    .single()
  if (error || !video) return { error: 'Video no encontrado' }
  if (video.storage_provider !== 'r2' || !video.drive_file_id) {
    return { error: 'Este video no está en R2' }
  }

  const client = r2Client()
  if (!client) return { error: 'R2 no está configurado' }

  try {
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: video.drive_file_id,
        ResponseContentDisposition: `attachment; filename="${video.name}"`,
      }),
      { expiresIn: 60 * 60 },
    )
    return { url }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error generando URL de descarga' }
  }
}

export async function deleteR2Video(videoId: string, ideaId: string): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const { data: video } = await supabase
    .from('content_idea_videos')
    .select('drive_file_id, storage_provider')
    .eq('id', videoId)
    .single()

  // Best-effort delete from R2; keep going even if it fails.
  if (video?.storage_provider === 'r2' && video.drive_file_id) {
    const client = r2Client()
    if (client) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: r2Bucket(), Key: video.drive_file_id }))
      } catch { /* ignore */ }
    }
  }

  const { error } = await supabase.from('content_idea_videos').update({ status: 'archived' }).eq('id', videoId)
  if (error) return { error: error.message }
  revalidatePath(`/produccion/idea/${ideaId}`)
  return { ok: true }
}
