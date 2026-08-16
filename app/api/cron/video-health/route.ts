import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2PublicUrl } from '@/lib/integrations/r2'
import { checkVideoPlayable } from '@/lib/integrations/video-health'
import { staleAnalysisCandidates } from '@/lib/utils/video-analysis-sweep'
import { cronAuthDenial } from '@/lib/auth/cron'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Daily health check for the public video gateway (the R2 Worker). It takes the
 * most recent EDITED R2 videos, hits their public URL with a Range request and
 * asserts the player-critical `206 + Accept-Ranges`. If the Worker regresses
 * (e.g. loses Range support again), this fails loudly via a non-200 response so
 * the Vercel cron run is flagged — instead of nobody noticing until a preview
 * spins. Protected by CRON_SECRET (lib/auth/cron.ts), same as the other crons
 * (see vercel.json). Fails closed.
 */
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const denial = cronAuthDenial(req)
  if (denial) return NextResponse.json(denial.body, { status: denial.status })

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

  // QC IA: cerrar análisis que nunca van a llegar (editor cerró el tab). Corre
  // ANTES del early-return de fallas para que un Worker caído no deje huérfanos
  // los análisis en "Analizando…" indefinidamente.
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ data: edited }, { data: analyses }] = await Promise.all([
      sb.from('content_idea_videos')
        .select('id, idea_id, uploaded_at')
        .eq('kind', 'edited').neq('status', 'archived').gte('uploaded_at', since),
      sb.from('content_idea_video_analysis')
        .select('video_id, status, updated_at').gte('updated_at', since),
    ])
    const stale = staleAnalysisCandidates(edited ?? [], analyses ?? [], new Date())
    const ERROR_NOTE = 'No se recibieron frames (posible tab cerrado durante la subida).'
    for (const s of stale) {
      if (s.hasRow) {
        // La fila ya existe como 'pending': el guard .eq('status','pending')
        // cierra la carrera con una ruta concurrente que acaba de escribir
        // 'done' — si eso pasó entre el SELECT y este UPDATE, no matchea y no
        // pisa nada (TOCTOU-safe).
        await sb.from('content_idea_video_analysis')
          .update({ status: 'error', error_note: ERROR_NOTE, updated_at: new Date().toISOString() })
          .eq('video_id', s.videoId)
          .eq('status', 'pending')
      } else {
        // Sin fila todavía: insert-ignore — si una ruta concurrente ya insertó
        // el 'done' entre el SELECT y aquí, ignoreDuplicates deja que gane esa
        // fila en vez de pisarla con 'error'.
        await sb.from('content_idea_video_analysis').upsert(
          {
            video_id: s.videoId, idea_id: s.ideaId, status: 'error',
            error_note: ERROR_NOTE, updated_at: new Date().toISOString(),
          },
          { onConflict: 'video_id', ignoreDuplicates: true },
        )
      }
    }
  } catch { /* best-effort: el health-check principal no depende de esto */ }

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
