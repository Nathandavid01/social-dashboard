import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@/lib/supabase/server'
import { isR2Configured, r2Bucket, r2Client } from '@/lib/integrations/r2'
import {
  entregasR2Bucket,
  entregasR2Client,
  isEntregasR2Configured,
} from '@/lib/integrations/entregas-r2'

/**
 * One cover image per video (its first thumb_key), presigned in a batch.
 * Server-only and UNGATED on purpose: callers check their own permission first
 * (Banco → video_bank.read, Inventario → video_stock.read). Never export this
 * from a 'use server' file — it would become a public action.
 */

const MAX_COVERS = 60

type BucketHandle = { client: NonNullable<ReturnType<typeof r2Client>>; bucket: string }

function bucketFor(provider: string): BucketHandle | null {
  if (provider === 'r2') {
    if (!isR2Configured()) return null
    const client = r2Client()
    return client ? { client, bucket: r2Bucket() } : null
  }
  if (provider === 'entregas-r2') {
    if (!isEntregasR2Configured()) return null
    const client = entregasR2Client()
    return client ? { client, bucket: entregasR2Bucket() } : null
  }
  return null
}

export async function signCoverUrls(
  videoIds: string[],
): Promise<{ urls?: Record<string, string>; error?: string }> {
  const ids = Array.from(new Set(videoIds.filter(Boolean))).slice(0, MAX_COVERS)
  if (ids.length === 0) return { urls: {} }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_idea_videos')
    .select('id, thumb_keys, storage_provider, status')
    .in('id', ids)
  if (error) return { error: error.message }

  const urls: Record<string, string> = {}
  await Promise.all(
    (data ?? []).map(async (row) => {
      if (row.status === 'archived' || row.status === 'failed') return
      const key = ((row.thumb_keys as string[] | null) ?? []).find(Boolean)
      if (!key) return
      const handle = bucketFor(row.storage_provider as string)
      if (!handle) return
      try {
        urls[row.id as string] = await getSignedUrl(
          handle.client,
          new GetObjectCommand({ Bucket: handle.bucket, Key: key, ResponseContentDisposition: 'inline' }),
          { expiresIn: 60 * 60 },
        )
      } catch {
        /* sin carátula: el tile enseña placeholder, nunca rompe */
      }
    }),
  )
  return { urls }
}
