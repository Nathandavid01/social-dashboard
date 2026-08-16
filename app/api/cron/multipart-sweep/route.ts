import { NextRequest, NextResponse } from 'next/server'
import { ListMultipartUploadsCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { r2Client, r2Bucket, isR2Configured } from '@/lib/integrations/r2'
import { entregasR2Client, entregasR2Bucket, isEntregasR2Configured } from '@/lib/integrations/entregas-r2'
import { isStaleMultipart, staleCutoffISO } from '@/lib/utils/multipart-sweep-core'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Reaps abandoned multipart (resilient) uploads — closing the tab mid-upload
 * leaves the parts already sent sitting in R2 with nothing client-side to
 * clean them up (the File was only ever in browser memory). Same CRON_SECRET
 * / Vercel cron auth as the other nightly jobs; see vercel.json.
 *
 * Per-bucket ListMultipartUploads + Abort is the belt; the R2
 * AbortIncompleteMultipartUpload lifecycle rule documented in CHANGELOG
 * v3.47 is the suspenders — this cron does not replace configuring it.
 */

type Provider = 'r2' | 'entregas-r2'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

async function sweepProvider(provider: Provider) {
  const client = provider === 'r2' ? r2Client() : entregasR2Client()
  const bucket = provider === 'r2' ? r2Bucket() : entregasR2Bucket()
  const configured = provider === 'r2' ? isR2Configured() : isEntregasR2Configured()
  if (!client || !configured) return { provider, skipped: true }

  const list = await client.send(new ListMultipartUploadsCommand({ Bucket: bucket }))
  const uploads = list.Uploads ?? []
  const now = new Date()
  const stale = uploads.filter((u) => isStaleMultipart(u.Initiated, now))

  let aborted = 0
  for (const u of stale) {
    if (!u.Key || !u.UploadId) continue
    try {
      await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: u.Key, UploadId: u.UploadId }))
      aborted++
    } catch (err) {
      console.error('[multipart-sweep] abort failed', provider, u.Key, err)
      // Best-effort; next run tries again.
    }
  }

  return { provider, scanned: uploads.length, aborted }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authed =
    (secret && req.headers.get('authorization') === `Bearer ${secret}`) ||
    req.headers.get('x-vercel-cron') !== null
  if (!authed) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const [r2Result, entregasResult] = await Promise.all([sweepProvider('r2'), sweepProvider('entregas-r2')])

  // Ownership rows (0065_multipart_uploads_ownership.sql) this old are safe
  // to drop regardless of which branch reaped the underlying multipart —
  // either it completed/aborted normally already, or the sweep above just
  // aborted it. Service role bypasses RLS since this isn't any one user.
  let staleOwnershipRowsCleared: number | null = null
  const cutoff = staleCutoffISO(new Date())
  const { error, count } = await admin()
    .from('multipart_uploads')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)
  if (error) {
    console.error('[multipart-sweep] ownership cleanup failed', error.message)
  } else {
    staleOwnershipRowsCleared = count ?? 0
  }

  return NextResponse.json({ r2: r2Result, entregas: entregasResult, staleOwnershipRowsCleared })
}
