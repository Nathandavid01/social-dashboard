'use server'

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import { r2Client, r2Bucket, r2PublicUrl } from '@/lib/integrations/r2'
import {
  entregasR2Client,
  entregasR2Bucket,
  entregasR2PublicUrl,
} from '@/lib/integrations/entregas-r2'

const MAX_IDS = 6

/**
 * Mint short-lived preview URLs for pipeline batch card strips.
 * Prefer permanent public URLs when configured; otherwise presigned GET (1h).
 */
export async function getBatchVideoPreviewUrls(
  videoIds: string[],
): Promise<{ urls?: Record<string, string>; error?: string }> {
  const canSee =
    (await currentUserHas('planning.read')) ||
    (await currentUserHas('revision.read')) ||
    (await currentUserHas('entregas.read'))
  if (!canSee) return { error: 'No autorizado' }

  const ids = Array.from(new Set(videoIds.filter(Boolean))).slice(0, MAX_IDS)
  if (ids.length === 0) return { urls: {} }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_idea_videos')
    .select('id, drive_file_id, storage_provider, kind, status')
    .in('id', ids)
  if (error) return { error: error.message }

  const urls: Record<string, string> = {}
  await Promise.all(
    (data ?? []).map(async (row) => {
      if (!row.drive_file_id) return
      if (row.status === 'archived' || row.status === 'failed') return

      const key = row.drive_file_id as string
      const provider = row.storage_provider as string

      if (provider === 'r2') {
        const pub = r2PublicUrl(key)
        if (pub) {
          urls[row.id as string] = pub
          return
        }
        const client = r2Client()
        if (!client) return
        try {
          urls[row.id as string] = await getSignedUrl(
            client,
            new GetObjectCommand({
              Bucket: r2Bucket(),
              Key: key,
              ResponseContentDisposition: 'inline',
            }),
            { expiresIn: 60 * 60 },
          )
        } catch {
          /* skip broken object */
        }
        return
      }

      if (provider === 'entregas-r2') {
        const pub = entregasR2PublicUrl(key)
        if (pub) {
          urls[row.id as string] = pub
          return
        }
        const client = entregasR2Client()
        if (!client) return
        try {
          urls[row.id as string] = await getSignedUrl(
            client,
            new GetObjectCommand({
              Bucket: entregasR2Bucket(),
              Key: key,
              ResponseContentDisposition: 'inline',
            }),
            { expiresIn: 60 * 60 },
          )
        } catch {
          /* skip */
        }
      }
    }),
  )

  return { urls }
}
