'use server'

import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { r2Client, r2Bucket, isR2Configured } from '@/lib/integrations/r2'
import { entregasR2Client, entregasR2Bucket, isEntregasR2Configured } from '@/lib/integrations/entregas-r2'

/**
 * Server-side half of resilient (multipart) uploads. Mirrors the routing of
 * idea-videos-r2.ts ('r2', the pipeline bucket) and entregas-r2.ts
 * ('entregas-r2', the editor deliveries bucket) — same dual-R2 split, same
 * `video.upload` gate as the existing single-PUT actions. Never merge these
 * two buckets' credentials.
 *
 * Ownership: `video.upload` is shared by owner/supervisor/editor/video, so
 * the role gate alone doesn't stop one holder from completing/aborting
 * ANOTHER holder's upload if they learn its { key, uploadId } (both flow
 * through the client). `multipart_uploads` (0065 migration) is the ownership
 * record; its RLS scopes every row to `created_by = auth.uid()`, so a
 * foreign uploadId resolves to "no row" — same as "not found" — without this
 * file doing any manual identity comparison.
 */
export type MultipartProvider = 'r2' | 'entregas-r2'

function authErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'No autorizado'
}

function clientFor(provider: MultipartProvider): { client: ReturnType<typeof r2Client> | ReturnType<typeof entregasR2Client>; bucket: string; ok: boolean } {
  if (provider === 'entregas-r2') {
    return { client: entregasR2Client(), bucket: entregasR2Bucket(), ok: isEntregasR2Configured() }
  }
  return { client: r2Client(), bucket: r2Bucket(), ok: isR2Configured() }
}

function keyPrefixFor(provider: MultipartProvider): string {
  return provider === 'entregas-r2' ? 'entregas' : 'ideas'
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function notConfiguredMessage(provider: MultipartProvider): string {
  return provider === 'entregas-r2' ? 'R2 de Entregas no está configurado (faltan ENTREGAS_R2_*)' : 'R2 no está configurado'
}

/** Records who started this multipart upload — the ownership check for complete/abort/presign. */
async function recordOwnership(input: { uploadId: string; key: string; ideaId: string; provider: MultipartProvider }): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }
  const { error } = await supabase.from('multipart_uploads').insert({
    upload_id: input.uploadId,
    key: input.key,
    idea_id: input.ideaId,
    provider: input.provider,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

/** True only if the CURRENT user is the one who started this uploadId (RLS-enforced, not a manual compare). */
async function ownsUpload(uploadId: string, key: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('multipart_uploads')
    .select('upload_id')
    .eq('upload_id', uploadId)
    .eq('key', key)
    .maybeSingle()
  return !!data
}

/** Best-effort cleanup once a multipart is done (completed or aborted) — never blocks the outer result. */
async function clearOwnership(uploadId: string): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('multipart_uploads').delete().eq('upload_id', uploadId)
  } catch {
    // Nothing pending in R2 anymore either way; a stale ownership row is harmless.
  }
}

/** Creates the multipart upload and returns the object key to use for every part. */
export async function startMultipartUpload(input: {
  provider: MultipartProvider
  ideaId: string
  kind: string
  fileName: string
  contentType: string
}): Promise<{ uploadId?: string; key?: string; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: authErrorMessage(err) }
  }

  const { client, bucket, ok } = clientFor(input.provider)
  if (!client || !ok) return { error: notConfiguredMessage(input.provider) }

  // Same key scheme as the single-PUT actions — the "edited" segment routes
  // the public-serving Worker for entregas-r2, and both are grouped under the
  // idea's id so downloads/listing keep working identically.
  const key = `${keyPrefixFor(input.provider)}/${input.ideaId}/${input.kind === 'edited' ? 'edited' : input.kind}/${Date.now()}-${slugify(input.fileName)}`

  let uploadId: string
  try {
    const res = await client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: input.contentType }))
    if (!res.UploadId) return { error: 'No se pudo iniciar la subida por partes' }
    uploadId = res.UploadId
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error iniciando la subida por partes' }
  }

  const owned = await recordOwnership({ uploadId, key, ideaId: input.ideaId, provider: input.provider })
  if (owned.error) {
    // Don't leave an untracked multipart nobody can prove ownership of.
    try {
      await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }))
    } catch {
      // Best-effort; surfacing the real (recordOwnership) error matters more.
    }
    return { error: owned.error }
  }

  return { uploadId, key }
}

/** Presigns a batch of part-PUT URLs in one call (not one round-trip per part). */
export async function presignUploadParts(input: {
  provider: MultipartProvider
  key: string
  uploadId: string
  partNumbers: number[]
}): Promise<{ urls?: Record<number, string>; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: authErrorMessage(err) }
  }

  const { client, bucket, ok } = clientFor(input.provider)
  if (!client || !ok) return { error: notConfiguredMessage(input.provider) }
  if (!(await ownsUpload(input.uploadId, input.key))) return { error: 'No autorizado para esta subida' }

  try {
    const entries = await Promise.all(
      input.partNumbers.map(async (partNumber) => {
        const url = await getSignedUrl(
          client,
          new UploadPartCommand({ Bucket: bucket, Key: input.key, UploadId: input.uploadId, PartNumber: partNumber }),
          { expiresIn: 60 * 60 },
        )
        return [partNumber, url] as const
      }),
    )
    return { urls: Object.fromEntries(entries) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error firmando las partes' }
  }
}

export async function completeMultipartUpload(input: {
  provider: MultipartProvider
  key: string
  uploadId: string
  parts: { partNumber: number; etag: string }[]
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: authErrorMessage(err) }
  }

  const { client, bucket, ok } = clientFor(input.provider)
  if (!client || !ok) return { error: notConfiguredMessage(input.provider) }
  if (!(await ownsUpload(input.uploadId, input.key))) return { error: 'No autorizado para esta subida' }

  try {
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: input.key,
        UploadId: input.uploadId,
        MultipartUpload: {
          Parts: [...input.parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    )
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error ensamblando el archivo' }
  }
  await clearOwnership(input.uploadId)
  return { ok: true }
}

/** Cancel/cleanup: aborts server-side so no orphaned parts keep paying for R2 storage. */
export async function abortMultipartUpload(input: {
  provider: MultipartProvider
  key: string
  uploadId: string
}): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('video.upload')
  } catch (err) {
    return { error: authErrorMessage(err) }
  }

  const { client, bucket, ok } = clientFor(input.provider)
  if (!client || !ok) return { error: notConfiguredMessage(input.provider) }
  if (!(await ownsUpload(input.uploadId, input.key))) return { error: 'No autorizado para esta subida' }

  try {
    await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: input.key, UploadId: input.uploadId }))
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error cancelando la subida' }
  }
  await clearOwnership(input.uploadId)
  return { ok: true }
}
