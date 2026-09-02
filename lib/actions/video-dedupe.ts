'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'

export interface DuplicateVideo {
  videoId: string
  kind: string
  fileName: string
  uploadedAt: string
  ideaId: string
  ideaTitle: string
  clientName: string | null
  uploadedBy: string | null
}

const FINGERPRINT_RE = /^v1-\d+-[0-9a-f]{64}$/

/**
 * ¿Este archivo ya se subió? Se consulta ANTES de crear ideas o abrir el
 * multipart, con la huella calculada en el navegador. Cualquier fallo de la
 * consulta (tabla aún no migrada, red) devuelve null: la deduplicación nunca
 * bloquea una subida legítima.
 */
export async function findDuplicateVideo(fingerprint: string): Promise<DuplicateVideo | null> {
  if (!FINGERPRINT_RE.test(fingerprint)) return null
  try {
    await requirePermission('video.upload')
  } catch {
    return null
  }
  const supabase = await createClient()
  // Dos lecturas: el guard de relaciones solo admite content_idea_videos
  // embebido desde content_ideas con su FK canónica, así que la huella se
  // resuelve primero y el video con su idea después.
  const { data: fp, error: fpError } = await supabase
    .from('content_idea_video_fingerprints')
    .select('video_id')
    .eq('fingerprint', fingerprint)
    .maybeSingle()
  if (fpError || !fp?.video_id) return null

  const { data: v, error } = await supabase
    .from('content_idea_videos')
    .select(`
      id, name, kind, status, uploaded_at,
      idea:content_ideas!content_idea_videos_idea_id_fkey(id, title, client:clients!content_ideas_client_id_fkey(id, name)),
      uploader:profiles!content_idea_videos_uploaded_by_fkey(full_name)
    `)
    .eq('id', fp.video_id as string)
    .maybeSingle()
  if (error || !v) return null
  const row = v as unknown as {
    id: string; name: string; kind: string; uploaded_at: string
    idea: { id: string; title: string; client?: { name?: string } | null } | null
    uploader: { full_name?: string | null } | null
  }
  return {
    videoId: row.id,
    kind: row.kind,
    fileName: row.name,
    uploadedAt: row.uploaded_at,
    ideaId: row.idea?.id ?? '',
    ideaTitle: row.idea?.title ?? '',
    clientName: row.idea?.client?.name ?? null,
    uploadedBy: row.uploader?.full_name ?? null,
  }
}

/**
 * Tras registrar el video, se anota su huella. La clave primaria de la tabla
 * es la huella: si dos subidas del mismo archivo se cruzan, la segunda recibe
 * `duplicate: true`. Best-effort: el video ya quedó registrado.
 */
export async function rememberVideoFingerprint(input: {
  fingerprint: string
  videoId: string
  sizeBytes: number
}): Promise<{ ok: true } | { ok: false; duplicate?: true }> {
  if (!FINGERPRINT_RE.test(input.fingerprint)) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase
    .from('content_idea_video_fingerprints')
    .insert({ fingerprint: input.fingerprint, video_id: input.videoId, size_bytes: input.sizeBytes })
  if (!error) return { ok: true }
  if (error.code === '23505') return { ok: false, duplicate: true }
  return { ok: false }
}
