'use server'

import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requirePermission } from '@/lib/auth/server'
import { r2Client, r2Bucket, isR2Configured } from '@/lib/integrations/r2'
import { entregasR2Client, entregasR2Bucket, isEntregasR2Configured } from '@/lib/integrations/entregas-r2'

/**
 * Server-side half of resilient (multipart) uploads. Mirrors the routing of
 * idea-videos-r2.ts ('r2', the pipeline bucket) and entregas-r2.ts
 * ('entregas-r2', the editor deliveries bucket) — same dual-R2 split, same
 * `video.upload` gate as the existing single-PUT actions. Never merge these
 * two buckets' credentials.
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

  try {
    const res = await client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: input.contentType }))
    if (!res.UploadId) return { error: 'No se pudo iniciar la subida por partes' }
    return { uploadId: res.UploadId, key }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error iniciando la subida por partes' }
  }
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
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error ensamblando el archivo' }
  }
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

  try {
    await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: input.key, UploadId: input.uploadId }))
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error cancelando la subida' }
  }
}
