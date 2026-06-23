import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2PublicUrl } from '@/lib/integrations/r2'
import { checkVideoPlayable } from '@/lib/integrations/video-health'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Daily health check for the public video gateway (the R2 Worker). It takes the
 * most recent EDITED R2 videos, hits their public URL with a Range request and
 * asserts the player-critical `206 + Accept-Ranges`. If the Worker regresses
 * (e.g. loses Range support again), this fails loudly via a non-200 response so
 * the Vercel cron run is flagged — instead of nobody noticing until a preview
 * spins. Protected by CRON_SECRET, same as the other crons (see vercel.json).
 */
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authed =
    (secret && req.headers.get('authorization') === `Bearer ${secret}`) ||
    req.headers.get('x-vercel-cron') !== null
  if (!authed) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const sb = admin()
  const { data: videos, error } = await sb
    .from('content_idea_videos')
    .select('id, drive_file_id, updated_at')
    .eq('kind', 'edited')
    .eq('storage_provider', 'r2')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(3)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!videos || videos.length === 0) {
    return NextResponse.json({ checked: 0, ok: true, note: 'No hay videos editados en R2 para chequear' })
  }

  const results = await Promise.all(
    videos.map(async (v) => {
      const key = v.drive_file_id as string | null
      const url = key ? r2PublicUrl(key) : null
      if (!url) return { id: v.id, ok: false, reason: 'No se pudo construir la URL pública' }
      const health = await checkVideoPlayable(url)
      return { id: v.id, url, ...(health.ok ? { ok: true } : { ok: false, reason: health.reason }) }
    }),
  )

  const failures = results.filter((r) => !r.ok)
  if (failures.length > 0) {
    // Non-200 → the Vercel cron run shows as failed and is visible in logs.
    console.error('[video-health] videos no reproducibles:', JSON.stringify(failures))
    return NextResponse.json(
      { ok: false, checked: results.length, failures },
      { status: 503 },
    )
  }

  return NextResponse.json({ ok: true, checked: results.length })
}
