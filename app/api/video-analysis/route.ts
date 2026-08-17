import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { analyzeVideoFrames, videoAnalysisModelId } from '@/lib/llm/video-analysis'
import { mergeVideoAnalysisFindings, type VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import { listenUrlForCaptionVideo } from '@/lib/integrations/caption-listen-url'
import { transcribeVideoFromUrl } from '@/lib/integrations/whisper'

/** El análisis con hasta 90 imágenes por chunk tarda; sin esto Vercel corta a los 10-15s. */
export const maxDuration = 300

// DEBE moverse en lockstep con FRAME_CHUNK_SIZE en lib/utils/video-frames.ts —
// el cliente nunca manda más de un chunk por request, así que este tope solo
// protege contra un caller que no pasó por chunkFrames(). 64, no 90: medido en
// producción un frame pesa ~50KB de cable (no ~46KB), así que 90 por chunk
// excedía FRAME_BUDGET_BYTES y hacía que se recortaran ~20 frames en silencio.
const MAX_FRAMES = 64

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
    { videoId?: unknown; frames?: unknown; timestamps?: unknown; cuts?: unknown; chunk?: unknown } | null
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

  const cuts = Array.isArray(body?.cuts)
    ? (body!.cuts as unknown[]).filter((t): t is number => typeof t === 'number' && Number.isFinite(t))
    : []

  const supabase = await createClient()
  const { data: video } = await supabase
    .from('content_idea_videos')
    .select('id, idea_id, kind, drive_file_id, storage_provider, idea:content_ideas!content_idea_videos_idea_id_fkey(id, title, hook, client:clients(name, brand_voice, caption_language, caption_notes))')
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

  // Transcripción del audio (Whisper), lanzada AQUÍ (antes del upsert
  // 'pending' de abajo) para que se solape con esa escritura y con la lectura
  // de `previousFindings` más abajo, en vez de esperarlas en serie — no se
  // await todavía. Solo en el PRIMER chunk: la transcripción es del video
  // COMPLETO (no cambia entre chunks), así que pedirla de nuevo en cada tanda
  // gastaría Whisper sin necesidad; mergeVideoAnalysisFindings conserva el
  // video_topic del primer chunk que traiga uno, así que es ahí donde importa.
  // No se puede solapar con la llamada a Grok (analyzeVideoFrames): su prompt
  // necesita el TEXTO ya transcrito, así que se await justo antes de construir
  // analysisCtx. Best-effort: sin URL de audio o si Whisper falla, transcript
  // queda null y el análisis sigue solo con lo visual — nunca bloquea ni
  // rompe la ruta.
  const transcriptPromise: Promise<string | null> = isFirstChunk
    ? (async () => {
        try {
          const listenUrl = await listenUrlForCaptionVideo({
            id: video.id,
            kind: video.kind,
            status: null,
            drive_file_id: (video as { drive_file_id?: string | null }).drive_file_id ?? null,
            storage_provider: (video as { storage_provider?: string | null }).storage_provider ?? null,
          })
          return listenUrl ? await transcribeVideoFromUrl(listenUrl) : null
        } catch {
          return null
        }
      })()
    : Promise.resolve(null)

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
    // frame_count se lee de la MISMA fila (no un segundo round-trip): si esa
    // columna no existiera aún, este select ya degradaría a "sin previo" para
    // findings también — mismo riesgo que ya asume el resto de esta ruta.
    let previousFindings: VideoAnalysisFindings | null = null
    let previousFrameCount = 0
    if (!isFirstChunk) {
      const { data: existing } = await supabase
        .from('content_idea_video_analysis')
        .select('findings, frame_count')
        .eq('video_id', video.id)
        .maybeSingle()
        .then((r) => r, () => ({ data: null }))
      const prevRow = existing as { findings?: VideoAnalysisFindings | null; frame_count?: number | null } | null
      previousFindings = prevRow?.findings ?? null
      previousFrameCount = typeof prevRow?.frame_count === 'number' ? prevRow.frame_count : 0
    }

    const transcript = await transcriptPromise
    const analysisCtx = {
      ideaTitle: idea?.title?.trim() || 'Sin título',
      hook: idea?.hook,
      clientName: idea?.client?.name,
      brandVoice: idea?.client?.brand_voice,
      captionLanguage: idea?.client?.caption_language,
      captionNotes: idea?.client?.caption_notes,
      transcript,
    }
    const chunkFindings = cuts.length > 0
      ? await analyzeVideoFrames(frames, analysisCtx, timestamps, cuts)
      : await analyzeVideoFrames(frames, analysisCtx, timestamps)
    const findings = isFirstChunk ? chunkFindings : mergeVideoAnalysisFindings(previousFindings, chunkFindings)
    const { error } = await upsert({
      status: 'done',
      findings,
      visual_summary: findings.visual_summary,
      model: videoAnalysisModelId(process.env),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Contador de fotogramas analizados, acumulado entre chunks — con un
    // UPDATE separado (no en el upsert de arriba) para que si la columna
    // `frame_count` no existe todavía (migración 0063 pendiente), el análisis
    // en sí (status/findings, ya escrito arriba) nunca se vea afectado.
    const frameCount = (isFirstChunk ? 0 : previousFrameCount) + frames.length
    try {
      await supabase
        .from('content_idea_video_analysis')
        .update({ frame_count: frameCount })
        .eq('video_id', video.id)
    } catch {
      // Columna sin migrar todavía: degrada seguro, simplemente no se cuenta.
    }

    // La IA no inventa el caption: solo aporta el DATO de qué es el video, y
    // entra por la MISMA casilla que llenaría una persona ("¿De qué es este
    // video?" = content_ideas.hook) — el caption lo sigue escribiendo
    // generateIdeaCaption con su aprendizaje de siempre. Regla dura: nunca
    // pisa texto humano, y solo en el ÚLTIMO chunk, con el video_topic ya
    // fundido de todos los chunks.
    //
    // TOCTOU: NO basta con mirar `idea?.hook` (leído al PRINCIPIO de la
    // petición, antes de analyzeVideoFrames) para decidir si escribir —
    // analyzeVideoFrames llama a Grok con hasta 64 fotogramas y puede tardar
    // decenas de segundos (maxDuration=300); justo en esa ventana es cuando
    // el editor está más probablemente viendo la idea recién subida y puede
    // escribir el hook a mano. Por eso el "sigue vacío" se comprueba en la
    // PROPIA query (`.is('hook', null)`), no en una lectura vieja: si una
    // persona escribió mientras tanto, el UPDATE no matchea ninguna fila y no
    // se toca nada (ni hook ni hook_source) — el caption de abajo igual se
    // encadena, y lee el hook humano ya persistido en la tabla.
    // El filtro `.is('hook', null)` (no `.or('hook.is.null,hook.eq.')`)
    // porque el hook SIEMPRE se normaliza a null cuando está vacío — nunca
    // queda como cadena vacía (ver updateIdeaBrief y updateIdeaHook: ambos
    // hacen `'' → null` antes de escribir).
    if (isLastChunk) {
      const videoTopic = findings.video_topic?.trim()
      if (videoTopic) {
        try {
          const { data: updated } = await supabase
            .from('content_ideas')
            .update({ hook: videoTopic })
            .eq('id', video.idea_id)
            .is('hook', null)
            .select('id')
          if (updated && updated.length > 0) {
            try {
              await supabase.from('content_ideas').update({ hook_source: 'ai' }).eq('id', video.idea_id)
            } catch {
              // Columna hook_source sin migrar todavía: el hook ya quedó escrito arriba.
            }
          }
        } catch {
          // Nunca bloquea el análisis ni el encadenado del caption.
        }
      }
    }

    // Encadena el auto-draft del caption SOLO tras el último chunk — antes de
    // eso el análisis está incompleto. generateIdeaCaption lo lee de la tabla
    // ya persistida arriba (incluido el hook que se acaba de escribir, si
    // aplica). Best-effort: sus errores ("falta hook", draft ya existente) no
    // son errores del análisis.
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
