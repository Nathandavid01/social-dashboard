import 'server-only'

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  entregasR2Bucket,
  entregasR2Client,
  isEntregasR2Configured,
} from '@/lib/integrations/entregas-r2'
import { attachmentDisposition } from '@/lib/utils/content-disposition'
import {
  OPERATOR_JOB_SELECT,
  decideRegister,
  editedVideoInsert,
  entregasEditedObjectKey,
  ideaInsertForStart,
  rawVideoInsert,
  registerUpdate,
  shapeOperatorJob,
  type NormalizedStart,
  type OperatorIdeaRow,
  type OperatorJobView,
  type OperatorVideoRow,
  type RetryRequest,
} from '@/lib/pipeline/operator-jobs'

const ENTREGAS_MISSING = 'R2 de Entregas no está configurado (faltan ENTREGAS_R2_*)'

export interface OperatorResult {
  status: number
  body: Record<string, unknown>
}

function currentEdited(videos: OperatorVideoRow[]): OperatorVideoRow | null {
  const usable = videos.filter(
    (v) =>
      v.kind === 'edited' &&
      v.storage_provider === 'entregas-r2' &&
      !!v.drive_file_id &&
      v.status !== 'archived' &&
      v.status !== 'failed',
  )
  usable.sort((a, b) => (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? ''))
  return usable[0] ?? null
}

async function presignPut(ideaId: string, fileName: string, contentType: string) {
  if (!isEntregasR2Configured()) return { error: ENTREGAS_MISSING as string }
  const client = entregasR2Client()
  if (!client) return { error: ENTREGAS_MISSING }
  const key = entregasEditedObjectKey(ideaId, fileName, Date.now())
  try {
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: entregasR2Bucket(), Key: key, ContentType: contentType }),
      { expiresIn: 60 * 60 },
    )
    return { url, key, method: 'PUT' as const, headers: { 'Content-Type': contentType } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No se pudo preparar la subida' }
  }
}

async function presignGet(video: OperatorVideoRow): Promise<string | null> {
  if (!video.drive_file_id || !isEntregasR2Configured()) return null
  const client = entregasR2Client()
  if (!client) return null
  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: entregasR2Bucket(),
        Key: video.drive_file_id,
        ResponseContentDisposition: attachmentDisposition(video.name),
      }),
      { expiresIn: 60 * 60 },
    )
  } catch {
    return null
  }
}

export async function loadOperatorJob(db: SupabaseClient, id: string): Promise<OperatorIdeaRow | null> {
  const { data, error } = await db
    .from('content_ideas')
    .select(OPERATOR_JOB_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as OperatorIdeaRow
}

async function presentJob(db: SupabaseClient, id: string): Promise<OperatorJobView | null> {
  const row = await loadOperatorJob(db, id)
  if (!row) return null
  const { data: analysis } = await db
    .from('content_idea_video_analysis')
    .select('status, error_note, visual_summary')
    .eq('idea_id', id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const edited = currentEdited(row.videos ?? [])
  const downloadUrl = edited ? await presignGet(edited) : null
  return shapeOperatorJob(row, {
    analysis: (analysis as { status: string; error_note?: string | null; visual_summary?: string | null } | null) ?? null,
    downloadUrl,
    downloadVideoId: edited?.id ?? null,
  })
}

export async function startOperatorJob(db: SupabaseClient, input: NormalizedStart): Promise<OperatorResult> {
  const { data: client, error: clientError } = await db
    .from('clients')
    .select('id, name')
    .eq('id', input.clientId)
    .maybeSingle()
  if (clientError) return { status: 500, body: { error: clientError.message } }
  if (!client) return { status: 404, body: { error: 'Cliente no encontrado' } }

  const { data: created, error } = await db
    .from('content_ideas')
    .insert(ideaInsertForStart(input))
    .select('id')
    .single()
  if (error || !created?.id) return { status: 500, body: { error: error?.message ?? 'No se pudo crear el trabajo' } }

  const raw = rawVideoInsert(created.id, input)
  if (raw) {
    const { error: videoError } = await db.from('content_idea_videos').insert(raw).select('id').single()
    if (videoError) {
      return { status: 500, body: { error: videoError.message, jobId: created.id } }
    }
  }

  const upload = input.fileName && input.contentType
    ? await presignPut(created.id, input.fileName, input.contentType)
    : null
  const job = await presentJob(db, created.id)
  return {
    status: 201,
    body: {
      job: job ?? { id: created.id },
      ...(upload ? { upload } : {}),
    },
  }
}

export async function listOperatorJobs(
  db: SupabaseClient,
  filter: { clientId: string | null; limit: number },
): Promise<OperatorResult> {
  let query = db.from('content_ideas').select(OPERATOR_JOB_SELECT)
  if (filter.clientId) query = query.eq('client_id', filter.clientId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(filter.limit)
  if (error) return { status: 500, body: { error: error.message } }
  const jobs = ((data ?? []) as unknown as OperatorIdeaRow[]).map((row) => shapeOperatorJob(row))
  return { status: 200, body: { count: jobs.length, jobs } }
}

export async function getOperatorJob(db: SupabaseClient, id: string): Promise<OperatorResult> {
  const job = await presentJob(db, id)
  if (!job) return { status: 404, body: { error: 'Trabajo no encontrado' } }
  return { status: 200, body: { job } }
}

export async function retryOperatorJob(
  db: SupabaseClient,
  id: string,
  request: RetryRequest,
  generateCaption: (
    db: SupabaseClient,
    ideaId: string,
  ) => Promise<{ ok?: true; caption?: string; error?: string }>,
): Promise<OperatorResult> {
  const row = await loadOperatorJob(db, id)
  if (!row) return { status: 404, body: { error: 'Trabajo no encontrado' } }

  if (request.step === 'caption') {
    const result = await generateCaption(db, id)
    if (result.error || !result.ok) {
      return { status: 422, body: { error: result.error ?? 'No se pudo generar el caption', jobId: id } }
    }
    const job = await presentJob(db, id)
    return { status: 200, body: { job, caption: result.caption ?? null } }
  }

  const decision = decideRegister(row)
  if (!decision.ok) return { status: 409, body: { error: decision.error } }

  if (request.step === 'upload') {
    const upload = await presignPut(id, request.fileName, request.contentType)
    if ('error' in upload) return { status: 503, body: { error: upload.error, jobId: id } }
    return { status: 200, body: { jobId: id, upload } }
  }

  const { data: video, error: videoError } = await db
    .from('content_idea_videos')
    .insert(editedVideoInsert({
      ideaId: id,
      key: request.key,
      name: request.name,
      sizeBytes: request.sizeBytes,
      mimeType: request.mimeType,
    }))
    .select('id')
    .single()
  if (videoError || !video?.id) {
    return { status: 500, body: { error: videoError?.message ?? 'No se pudo registrar el corte' } }
  }

  const patch = registerUpdate(row, new Date().toISOString())
  let reviewUnchanged = !decision.submitToReview
  if (patch) {
    const { data: changed, error: updateError } = await db
      .from('content_ideas')
      .update(patch)
      .eq('id', id)
      .eq('approval_status', row.approval_status)
      .eq('status', row.status)
      .select('id')
      .maybeSingle()
    if (updateError || !changed) {
      reviewUnchanged = true
    } else {
      reviewUnchanged = false
    }
  }

  const job = await presentJob(db, id)
  return {
    status: 200,
    body: {
      job,
      videoId: video.id,
      reviewUnchanged,
      ...(reviewUnchanged
        ? { note: 'El corte quedó registrado. El estado de revisión no cambió.' }
        : { note: 'El corte quedó registrado y pasó a revisión.' }),
    },
  }
}
