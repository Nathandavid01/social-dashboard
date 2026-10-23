import type { ContentIdeaVideo, IdeaApprovalStatus } from '@/lib/supabase/types'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'
import { isReadyToEdit } from '@/lib/utils/edit-queue'
import { computeIdeaProgress, type IdeaProgress } from '@/lib/utils/idea-progress'
import { isAllowedVideoUploadType } from '@/lib/utils/video-upload-guard'

/** 5 GB — el mismo tope que la tarjeta de Editores en Video QC. */
export const OPERATOR_VIDEO_MAX_BYTES = 5 * 1024 * 1024 * 1024

/**
 * Parqueo del contrato retirado (PR #265). Esas filas no son videos de
 * Pipeline de videos y este operador no las lista ni las modifica.
 */
export const OPERATOR_HOLD_THEME = 'operator-hold'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACTIVE: ReadonlySet<string> = new Set(['uploading', 'uploaded', 'processing'])

const TYPE_LABEL: Record<string, string> = {
  R: 'Reel',
  P: 'Post',
  C: 'Carrusel',
  S: 'Story',
}
const STATUS_LABEL: Record<string, string> = {
  idea: 'Idea',
  asignada: 'Asignada',
  grabada: 'Grabada',
  producida: 'En producción',
  publicada: 'Publicada',
  descartada: 'Descartada',
}
const APPROVAL_LABEL: Record<string, string> = {
  pending: 'Sin enviar',
  submitted: 'En revisión',
  approved: 'Aprobado',
  revision_needed: 'Cambios',
}

export interface NormalizedSubmit {
  ideaId: string
  fileName: string
  contentType: string
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export interface OperatorVideoRow {
  id: string
  kind: string
  status: string
  storage_provider: string | null
  name: string | null
  drive_file_id: string | null
  drive_view_link: string | null
  mime_type: string | null
  size_bytes: number | null
  uploaded_at: string | null
}

export interface OperatorIdeaRow {
  id: string
  client_id: string
  title: string
  hook: string | null
  content_type: string
  status: string
  approval_status: string
  publish_date: string | null
  published_at: string | null
  generated_caption: string | null
  caption_draft: string | null
  theme?: string | null
  created_at: string
  client: { id: string; name: string } | { id: string; name: string }[] | null
  videos: OperatorVideoRow[] | null
}

export interface OperatorOutput {
  kind: 'raw' | 'broll' | 'edited'
  label: string
  videoId: string
  provider: string | null
  href?: string | null
}

export interface PipelineItemView {
  id: string
  clientId: string
  clientName: string
  title: string
  contentType: string
  contentTypeLabel: string
  status: string
  statusLabel: string
  approvalStatus: string
  approvalLabel: string
  readyToEdit: boolean
  stageLabel: string
  progress: IdeaProgress
  slots: { raw: number; broll: number; edited: number }
  publishDate: string | null
  publishedAt: string | null
  caption: { draft: string | null; generated: string | null }
  outputs: OperatorOutput[]
  retryable: Array<'upload' | 'register' | 'caption'>
}

export type RetryRequest =
  | { step: 'caption' }
  | { step: 'upload'; fileName: string; contentType: string }
  | { step: 'register'; key: string; name: string; sizeBytes: number; mimeType: string }

export type OperatorQueue = 'todos' | 'editores'

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  return body as Record<string, unknown>
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** Mismo slug que getR2UploadUrl: minúsculas, sin marcas, máximo 80. */
export function pipelineFileSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function pipelineEditedObjectKey(ideaId: string, fileName: string, nowMs: number): string {
  return `ideas/${ideaId}/edited/${nowMs}-${pipelineFileSlug(fileName)}`
}

export function assertPipelineEditedKey(ideaId: string, key: string): string | null {
  const prefix = `ideas/${ideaId}/edited/`
  const rest = key.startsWith(prefix) ? key.slice(prefix.length) : ''
  if (!rest || rest.includes('/') || rest.includes('..') || key.includes('..')) {
    return 'La key no es el corte editado de este video en el bucket del pipeline'
  }
  return null
}

export function includePipelineRow(idea: { theme?: string | null }): boolean {
  return idea.theme !== OPERATOR_HOLD_THEME
}

function oneClient(client: OperatorIdeaRow['client']): { id: string; name: string } | null {
  if (!client) return null
  return Array.isArray(client) ? client[0] ?? null : client
}

function activeVideos(videos: OperatorVideoRow[] | null | undefined): OperatorVideoRow[] {
  return (videos ?? []).filter((v) => ACTIVE.has(v.status))
}

function asPipelineVideo(idea: {
  status: string
  videos: Array<{ kind: string; status: string }>
}): PipelineVideo {
  const videos = idea.videos as unknown as ContentIdeaVideo[]
  return {
    status: idea.status,
    videos: {
      raw: videos.filter((v) => v.kind === 'raw'),
      broll: videos.filter((v) => v.kind === 'broll'),
      edited: videos.filter((v) => v.kind === 'edited'),
    },
  } as PipelineVideo
}

export function acceptsEditedUpload(idea: {
  status: string
  approval_status: string
  published_at?: string | null
  theme?: string | null
  videos: Array<{ kind: string; status: string }>
}): boolean {
  if (!includePipelineRow(idea)) return false
  if (idea.status === 'descartada' || idea.status === 'publicada') return false
  if (idea.published_at) return false
  if (idea.approval_status === 'approved') return false
  return isReadyToEdit(asPipelineVideo(idea))
}

export function parseSubmit(body: unknown): Parsed<NormalizedSubmit> {
  const record = asRecord(body)
  if (!record) return { ok: false, error: 'El cuerpo tiene que ser un objeto JSON' }
  const ideaId = optionalText(record.ideaId)
  if (!ideaId) {
    return {
      ok: false,
      error: 'El Pipeline de videos (Video QC) no crea ideas. Manda ideaId de un video que ya está en /video-reviews.',
    }
  }
  if (!UUID_RE.test(ideaId)) return { ok: false, error: 'La idea no es un id válido' }
  const kind = optionalText(record.kind)
  if (kind && kind !== 'edited') {
    return { ok: false, error: 'Este operador solo sube el corte editado (kind edited).' }
  }
  const fileName = optionalText(record.fileName)
  const contentType = optionalText(record.contentType)
  if (!fileName || !contentType) return { ok: false, error: 'Hacen falta fileName y contentType' }
  if (!isAllowedVideoUploadType(contentType)) {
    return { ok: false, error: 'Tipo de archivo no permitido. Solo se aceptan videos (mp4, mov, webm, etc.).' }
  }
  return { ok: true, value: { ideaId, fileName, contentType } }
}

export type ParsedRetry = ({ ok: true } & RetryRequest) | { ok: false; error: string }

export function parseRetry(body: unknown, ideaId?: string): ParsedRetry {
  const record = asRecord(body)
  if (!record) return { ok: false, error: 'El cuerpo tiene que ser un objeto JSON' }
  if (ideaId && typeof record.ideaId === 'string' && record.ideaId !== ideaId) {
    return { ok: false, error: 'La idea del cuerpo no coincide con la URL' }
  }
  const step = optionalText(record.step)
  if (step === 'caption') return { ok: true, step: 'caption' }
  if (step === 'upload') {
    const kind = optionalText(record.kind)
    if (kind && kind !== 'edited') {
      return { ok: false, error: 'Este operador solo sube el corte editado (kind edited).' }
    }
    const fileName = optionalText(record.fileName)
    const contentType = optionalText(record.contentType)
    if (!fileName || !contentType) return { ok: false, error: 'upload necesita fileName y contentType' }
    if (!isAllowedVideoUploadType(contentType)) {
      return { ok: false, error: 'Tipo de archivo no permitido. Solo se aceptan videos (mp4, mov, webm, etc.).' }
    }
    return { ok: true, step: 'upload', fileName, contentType }
  }
  if (step === 'register') {
    const key = optionalText(record.key)
    const name = optionalText(record.name)
    const mimeType = optionalText(record.mimeType)
    const sizeBytes = record.sizeBytes
    if (!ideaId || !key || !name || !mimeType || typeof sizeBytes !== 'number') {
      return { ok: false, error: 'register necesita key, name, sizeBytes y mimeType' }
    }
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > OPERATOR_VIDEO_MAX_BYTES) {
      return { ok: false, error: 'El video debe pesar entre 1 byte y 5 GB.' }
    }
    if (!isAllowedVideoUploadType(mimeType)) {
      return { ok: false, error: 'Tipo de archivo no permitido. Solo se aceptan videos (mp4, mov, webm, etc.).' }
    }
    const keyError = assertPipelineEditedKey(ideaId, key)
    if (keyError) return { ok: false, error: keyError }
    return { ok: true, step: 'register', key, name, sizeBytes, mimeType }
  }
  return { ok: false, error: 'Paso de reintento no reconocido. Usa caption, upload o register.' }
}

export function parseListQuery(params: { get(name: string): string | null }): Parsed<{
  clientId: string | null
  limit: number
  queue: OperatorQueue
}> {
  const clientRaw = params.get('clientId')?.trim() || ''
  if (clientRaw && !UUID_RE.test(clientRaw)) return { ok: false, error: 'El cliente no es un id válido' }
  const queueRaw = params.get('queue')?.trim() || 'todos'
  if (queueRaw !== 'todos' && queueRaw !== 'editores') {
    return { ok: false, error: 'queue tiene que ser todos o editores' }
  }
  const limitRaw = params.get('limit')
  let limit = 20
  if (limitRaw != null && limitRaw !== '') {
    const parsed = Number(limitRaw)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      return { ok: false, error: 'limit tiene que ser un entero entre 1 y 50' }
    }
    limit = parsed
  }
  return { ok: true, value: { clientId: clientRaw || null, limit, queue: queueRaw } }
}

export function pipelineVideoInsert(input: {
  ideaId: string
  key: string
  name: string
  sizeBytes: number
  mimeType: string
}): Record<string, unknown> {
  return {
    idea_id: input.ideaId,
    kind: 'edited',
    name: input.name,
    drive_file_id: input.key,
    storage_provider: 'r2',
    size_bytes: input.sizeBytes,
    mime_type: input.mimeType,
    uploaded_by: null,
    status: 'uploaded',
  }
}

export function inOperatorQueue(row: OperatorIdeaRow, queue: OperatorQueue): boolean {
  if (!includePipelineRow(row)) return false
  if (queue === 'todos') return true
  return isReadyToEdit(asPipelineVideo({ status: row.status, videos: row.videos ?? [] }))
}

export function shapePipelineItem(
  row: OperatorIdeaRow,
  extras?: { assetCount?: number; downloadUrls?: Record<string, string | null> },
): PipelineItemView {
  const videos = row.videos ?? []
  const active = activeVideos(videos)
  const count = (kind: string) => active.filter((v) => v.kind === kind).length
  const progress = computeIdeaProgress({
    idea: {
      hook: row.hook,
      visual_brief: null,
      generated_caption: row.generated_caption,
      approval_status: row.approval_status as IdeaApprovalStatus,
      published_at: row.published_at,
    },
    videos: videos as unknown as ContentIdeaVideo[],
    assetCount: extras?.assetCount ?? 0,
  })
  const current = progress.stages.find((stage) => !stage.done)
  const readyToEdit = isReadyToEdit(asPipelineVideo({ status: row.status, videos }))
  const client = oneClient(row.client)
  const outputs: OperatorOutput[] = active
    .filter((video) => video.kind === 'raw' || video.kind === 'broll' || video.kind === 'edited')
    .map((video) => ({
      kind: video.kind as OperatorOutput['kind'],
      label: video.name || video.kind,
      videoId: video.id,
      provider: video.storage_provider,
      href: extras?.downloadUrls?.[video.id] ?? (video.storage_provider === 'drive' ? video.drive_view_link : null),
    }))
  const retryable: PipelineItemView['retryable'] = []
  if (acceptsEditedUpload({ ...row, videos })) retryable.push('upload', 'register')
  if (row.status !== 'descartada') retryable.push('caption')
  const draft = row.caption_draft?.trim() || null
  const generated = row.generated_caption?.trim() || null
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: client?.name ?? '',
    title: row.title,
    contentType: row.content_type,
    contentTypeLabel: TYPE_LABEL[row.content_type] ?? 'Reel',
    status: row.status,
    statusLabel: STATUS_LABEL[row.status] ?? row.status,
    approvalStatus: row.approval_status,
    approvalLabel: APPROVAL_LABEL[row.approval_status] ?? row.approval_status,
    readyToEdit,
    stageLabel: current?.label ?? 'Publicado',
    progress,
    slots: { raw: count('raw'), broll: count('broll'), edited: count('edited') },
    publishDate: row.publish_date,
    publishedAt: row.published_at,
    caption: { draft, generated },
    outputs,
    retryable,
  }
}

/** Select embebido. La pista del FK es obligatoria (PGRST201). */
export const PIPELINE_ITEM_SELECT = [
  'id',
  'client_id',
  'title',
  'hook',
  'content_type',
  'status',
  'approval_status',
  'publish_date',
  'published_at',
  'generated_caption',
  'caption_draft',
  'theme',
  'created_at',
  'client:clients!content_ideas_client_id_fkey(id, name)',
  'videos:content_idea_videos!content_idea_videos_idea_id_fkey(id, kind, status, storage_provider, name, drive_file_id, drive_view_link, mime_type, size_bytes, uploaded_at)',
].join(', ')

/**
 * PostgREST: `.neq('theme','operator-hold')` también elimina theme null.
 * Este filtro conserva null y cualquier theme distinto del parqueo retirado.
 */
export const PIPELINE_THEME_OR = 'theme.is.null,theme.neq.operator-hold'
