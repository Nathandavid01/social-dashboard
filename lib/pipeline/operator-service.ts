import 'server-only'

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isR2Configured, r2Bucket, r2Client } from '@/lib/integrations/r2'
import { attachmentDisposition } from '@/lib/utils/content-disposition'
import {
  PIPELINE_ITEM_SELECT,
  PIPELINE_THEME_OR,
  acceptsEditedUpload,
  includePipelineRow,
  inOperatorQueue,
  pipelineEditedObjectKey,
  pipelineVideoInsert,
  shapePipelineItem,
  type NormalizedSubmit,
  type OperatorIdeaRow,
  type OperatorQueue,
  type OperatorVideoRow,
  type PipelineItemView,
  type RetryRequest,
} from '@/lib/pipeline/operator-jobs'

const R2_MISSING = 'R2 no está configurado (faltan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID o R2_SECRET_ACCESS_KEY)'
const NOT_IN_PIPELINE = 'Ese video no está en Pipeline de videos'
const NOT_IN_EDITORS = 'Este video no está en Editores. Hace falta material crudo activo y que todavía no tenga corte.'

export interface OperatorResult {
  status: number
  body: Record<string, unknown>
}

async function presignPut(ideaId: string, fileName: string, contentType: string) {
  if (!isR2Configured()) return { error: R2_MISSING }
  const client = r2Client()
  if (!client) return { error: R2_MISSING }
  const key = pipelineEditedObjectKey(ideaId, fileName, Date.now())
  try {
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: r2Bucket(), Key: key, ContentType: contentType }),
      { expiresIn: 60 * 60 },
    )
    return { url, key, method: 'PUT' as const, headers: { 'Content-Type': contentType } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No se pudo preparar la subida' }
  }
}

async function presignGet(video: OperatorVideoRow): Promise<string | null> {
  if (video.storage_provider !== 'r2' || !video.drive_file_id || !isR2Configured()) return null
  const client = r2Client()
  if (!client) return null
  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: video.drive_file_id,
        ResponseContentDisposition: attachmentDisposition(video.name),
      }),
      { expiresIn: 60 * 60 },
    )
  } catch {
    return null
  }
}

export async function loadPipelineItem(db: SupabaseClient, id: string): Promise<OperatorIdeaRow | null> {
  const { data, error } = await db
    .from('content_ideas')
    .select(PIPELINE_ITEM_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  const row = data as unknown as OperatorIdeaRow
  if (!includePipelineRow(row)) return null
  return row
}

async function assetCount(db: SupabaseClient, clientId: string): Promise<number> {
  const { count, error } = await db
    .from('client_assets')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
  if (error || typeof count !== 'number') return 0
  return count
}

async function presentItem(db: SupabaseClient, id: string): Promise<PipelineItemView | null> {
  const row = await loadPipelineItem(db, id)
  if (!row) return null
  const assets = await assetCount(db, row.client_id)
  const downloadUrls: Record<string, string | null> = {}
  for (const video of row.videos ?? []) {
    if (video.storage_provider === 'r2' && video.drive_file_id) {
      downloadUrls[video.id] = await presignGet(video)
    }
  }
  return shapePipelineItem(row, { assetCount: assets, downloadUrls })
}

function closed(row: OperatorIdeaRow): OperatorResult | null {
  if (acceptsEditedUpload({ ...row, videos: row.videos ?? [] })) return null
  return { status: 409, body: { error: NOT_IN_EDITORS } }
}

export async function submitPipelineVideo(db: SupabaseClient, input: NormalizedSubmit): Promise<OperatorResult> {
  const row = await loadPipelineItem(db, input.ideaId)
  if (!row) return { status: 404, body: { error: NOT_IN_PIPELINE } }
  const blocked = closed(row)
  if (blocked) return blocked
  const upload = await presignPut(input.ideaId, input.fileName, input.contentType)
  if ('error' in upload) return { status: 503, body: { error: upload.error } }
  const item = await presentItem(db, input.ideaId)
  return { status: 200, body: { item: item ?? { id: input.ideaId }, upload } }
}

export async function listOperatorJobs(
  db: SupabaseClient,
  filter: { clientId: string | null; limit: number; queue: OperatorQueue },
): Promise<OperatorResult> {
  let query = db
    .from('content_ideas')
    .select(PIPELINE_ITEM_SELECT)
    .or(PIPELINE_THEME_OR)
  if (filter.clientId) query = query.eq('client_id', filter.clientId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(filter.limit)
  if (error) return { status: 500, body: { error: error.message } }
  const items = ((data ?? []) as unknown as OperatorIdeaRow[])
    .filter((row) => inOperatorQueue(row, filter.queue))
    .map((row) => shapePipelineItem(row))
  return { status: 200, body: { count: items.length, items } }
}

export async function getOperatorJob(db: SupabaseClient, id: string): Promise<OperatorResult> {
  const item = await presentItem(db, id)
  if (!item) return { status: 404, body: { error: NOT_IN_PIPELINE } }
  return { status: 200, body: { item } }
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
  const row = await loadPipelineItem(db, id)
  if (!row) return { status: 404, body: { error: NOT_IN_PIPELINE } }

  if (request.step === 'caption') {
    const result = await generateCaption(db, id)
    if (result.error || !result.ok) {
      return { status: 422, body: { error: result.error ?? 'No se pudo generar el caption', ideaId: id } }
    }
    const item = await presentItem(db, id)
    return {
      status: 200,
      body: {
        item,
        caption: result.caption ?? null,
        note: 'El borrador quedó en caption_draft. La etapa Caption del tab usa generated_caption y no se promueve aquí.',
      },
    }
  }

  const blocked = closed(row)
  if (blocked) return blocked

  if (request.step === 'upload') {
    const upload = await presignPut(id, request.fileName, request.contentType)
    if ('error' in upload) return { status: 503, body: { error: upload.error, ideaId: id } }
    return { status: 200, body: { ideaId: id, upload } }
  }

  const { data: video, error: videoError } = await db
    .from('content_idea_videos')
    .insert(pipelineVideoInsert({
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

  const item = await presentItem(db, id)
  return {
    status: 200,
    body: {
      item,
      videoId: video.id,
      note: 'El corte quedó en Pipeline de videos. La idea no cambió de estado y no entró a Revisión.',
    },
  }
}
