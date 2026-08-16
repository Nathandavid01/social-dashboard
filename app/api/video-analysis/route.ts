import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { analyzeVideoFrames, videoAnalysisModelId } from '@/lib/llm/video-analysis'
import { mergeVideoAnalysisFindings, type VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'

/** El análisis con hasta 90 imágenes por chunk tarda; sin esto Vercel corta a los 10-15s. */
export const maxDuration = 300

// DEBE moverse en lockstep con FRAME_CHUNK_SIZE en lib/utils/video-frames.ts —
// el cliente nunca manda más de un chunk por request, así que este tope solo
// protege contra un caller que no pasó por chunkFrames().
const MAX_FRAMES = 90

interface ChunkInfo { index: number; total: number }

/** Chunk tolerante: cualquier forma inesperada (índice no numérico, fuera de
 *  rango, total<1) se trata como "chunk único" — nunca 400 por esto. */
function parseChunk(raw: unknown): ChunkInfo {
  const c = raw as { index?: unknown; total?: unknown } | null | undefined
  const index = typeof c?.index === 'number' && Number.isInteger(c.index) ? c.index : null
  const total = typeof c?.total === 'number' && Number.isInteger(c.total) ? c.total : null
  if (index === null || total === null || total < 1 || index < 0 || index >= total) {
    return { index: 0, total: 1 }
  }
  return { index, total }
}

/**
 * QC IA del video editado. Lo dispara el browser del editor tras registrar la
 * subida (fire-and-forget). Upsert por video_id: re-subir supersede el análisis.
 * Advisory: aquí ningún error es fatal para el pipeline — queda una fila 'error'.
 */
export async function POST(request: Request) {
  try {
    await requirePermission('video.upload')
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as
    { videoId?: unknown; frames?: unknown; timestamps?: unknown; chunk?: unknown } | null
  const videoId = typeof body?.videoId === 'string' ? body.videoId : null
  const frames = Array.isArray(body?.frames)
    ? (body!.frames as unknown[]).filter(
        (f): f is string => typeof f === 'string' && f.startsWith('data:image/jpeg;base64,'),
      ).slice(0, MAX_FRAMES)
    : []
  if (!videoId || frames.length === 0) {
    return NextResponse.json({ error: 'videoId y frames son requeridos' }, { status: 400 })
  }
  const chunk = parseChunk(body?.chunk)
  const isFirstChunk = chunk.index === 0
  const isLastChunk = chunk.index === chunk.total - 1

  // Los timestamps son solo un extra para el prompt (etiquetas de tiempo);
  // si no cuadran con los frames, se ignoran silenciosamente — nunca 400.
  const rawTimestamps = Array.isArray(body?.timestamps) ? (body!.timestamps as unknown[]) : null
  const timestamps = rawTimestamps
    && rawTimestamps.length === frames.length
    && rawTimestamps.every((t): t is number => typeof t === 'number' && Number.isFinite(t))
    ? (rawTimestamps as number[])
    : undefined

  const supabase = await createClient()
  const { data: video } = await supabase
    .from('content_idea_videos')
    .select('id, idea_id, kind, idea:content_ideas!content_idea_videos_idea_id_fkey(id, title, hook, client:clients(name, brand_voice, caption_language, caption_notes))')
    .eq('id', videoId)
    .single()
  if (!video || video.kind !== 'edited') {
    return NextResponse.json({ error: 'Video editado no encontrado' }, { status: 404 })
  }

  const upsert = (row: Record<string, unknown>) =>
    supabase.from('content_idea_video_analysis').upsert(
      { video_id: video.id, idea_id: video.idea_id, updated_at: new Date().toISOString(), ...row },
      { onConflict: 'video_id' },
    )

  // Solo el primer chunk inicializa la fila a 'pending': un chunk >0 sobre una
  // fila que ya tiene findings de chunks anteriores NO debe borrarlos.
  if (isFirstChunk) {
    const { error: pendingError } = await upsert({ status: 'pending', findings: null, visual_summary: null, error_note: null })
    if (pendingError) return NextResponse.json({ error: 'Análisis no disponible' }, { status: 503 })
  }

  const idea = video.idea as {
    title?: string | null; hook?: string | null
    client?: { name?: string | null; brand_voice?: string | null; caption_language?: string | null; caption_notes?: string | null } | null
  } | null
  try {
    // Chunk >0: lee lo que ya hay ANTES de gastar la llamada a Grok, para
    // fundir con lo nuevo. Si esta lectura falla, se trata como "sin previo"
    // (mergeVideoAnalysisFindings tolera null) — nunca bloquea el chunk.
    let previousFindings: VideoAnalysisFindings | null = null
    if (!isFirstChunk) {
      const { data: existing } = await supabase
        .from('content_idea_video_analysis')
        .select('findings')
        .eq('video_id', video.id)
        .maybeSingle()
        .then((r) => r, () => ({ data: null }))
      previousFindings = (existing as { findings?: VideoAnalysisFindings | null } | null)?.findings ?? null
    }

    const analysisCtx = {
      ideaTitle: idea?.title?.trim() || 'Sin título',
      hook: idea?.hook,
      clientName: idea?.client?.name,
      brandVoice: idea?.client?.brand_voice,
      captionLanguage: idea?.client?.caption_language,
      captionNotes: idea?.client?.caption_notes,
    }
    const chunkFindings = await analyzeVideoFrames(frames, analysisCtx, timestamps)
    const findings = isFirstChunk ? chunkFindings : mergeVideoAnalysisFindings(previousFindings, chunkFindings)
    const { error } = await upsert({
      status: 'done',
      findings,
      visual_summary: findings.visual_summary,
      model: videoAnalysisModelId(process.env),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Encadena el auto-draft del caption SOLO tras el último chunk — antes de
    // eso el análisis está incompleto. generateIdeaCaption lo lee de la tabla
    // ya persistida arriba. Best-effort: sus errores ("falta hook", draft ya
    // existente) no son errores del análisis.
    if (isLastChunk) {
      await generateIdeaCaption(video.idea_id, { auto: true }).catch(() => null)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    // Un chunk >0 que falla NO marca la fila 'error': ya tiene findings
    // válidos de chunks anteriores (o los tendrá de uno posterior) — pisarlos
    // con 'error' sería peor que dejar la fila como estaba.
    if (isFirstChunk) {
      await upsert({ status: 'error', error_note: err instanceof Error ? err.message : 'Error desconocido' })
    }
    return NextResponse.json({ error: 'El análisis falló' }, { status: 502 })
  }
}
