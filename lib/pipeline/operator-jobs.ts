import { ENTREGA_LABEL_ES, ideaStage } from '@/lib/entregas/batches'
import type { IdeaApprovalStatus, IdeaWithPipeline } from '@/lib/supabase/types'
import { parseDriveFileId, driveViewLink } from '@/lib/utils/drive-link'
import { isAllowedVideoUploadType } from '@/lib/utils/video-upload-guard'

/** 2 GB — mismo tope que el video del calendario. */
export const OPERATOR_VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024

/**
 * Parqueo hasta que exista el corte. `descartada` no entra a On Site, Mi Día,
 * runway, inventario ni al banco del editor. No es un descarte del equipo:
 * `theme` lo distingue y el registro lo saca de ahí.
 */
export const OPERATOR_HOLD_THEME = 'operator-hold'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type OperatorPhase = 'edited' | 'raw'

export interface NormalizedStart {
  clientId: string
  title: string
  hook: string | null
  publishDate: string | null
  driveFileId: string | null
  driveViewLink: string | null
  phase: OperatorPhase
  fileName: string | null
  contentType: string | null
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export interface IdeaGate {
  status: string
  approval_status: string
  published_at?: string | null
  metricool_post_id?: unknown
  posted_at?: string | null
  posting_started_at?: string | null
  theme?: string | null
}

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
  status: string
  approval_status: string
  publish_date: string | null
  published_at: string | null
  generated_caption: string | null
  caption_draft: string | null
  metricool_post_id: string | number | null
  posted_at: string | null
  posting_started_at: string | null
  visual_brief: string | null
  theme?: string | null
  created_at: string
  client: { id: string; name: string } | { id: string; name: string }[] | null
  videos: OperatorVideoRow[] | null
}

export interface OperatorOutput {
  kind: 'edited' | 'raw' | 'drive' | 'caption_draft' | 'caption' | 'metricool'
  label: string
  videoId?: string
  href?: string | null
  text?: string | null
}

export interface OperatorJobView {
  id: string
  clientId: string
  clientName: string
  title: string
  hook: string | null
  status: string
  approvalStatus: string
  stage: string
  stageLabel: string
  publishDate: string | null
  publishedAt: string | null
  caption: { draft: string | null; generated: string | null }
  metricool: { postId: string | number | null; postedAt: string | null }
  videos: OperatorVideoRow[]
  analysis: { status: string; errorNote: string | null; hasVisualSummary: boolean } | null
  outputs: OperatorOutput[]
  retryable: Array<'caption' | 'upload' | 'register'>
  downloadUrl: string | null
}

export type RetryRequest =
  | { step: 'caption' }
  | { step: 'upload'; fileName: string; contentType: string }
  | { step: 'register'; key: string; name: string; sizeBytes: number; mimeType: string }

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  return body as Record<string, unknown>
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function slugifyFileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || 'video.mp4'
}

export function entregasEditedObjectKey(ideaId: string, fileName: string, nowMs: number): string {
  return `entregas/${ideaId}/edited/${nowMs}-${slugifyFileName(fileName)}`
}

export function assertEntregasEditedKey(ideaId: string, key: string): string | null {
  const prefix = `entregas/${ideaId}/edited/`
  const rest = key.startsWith(prefix) ? key.slice(prefix.length) : ''
  if (!rest || rest.includes('/') || rest.includes('..') || key.includes('..')) {
    return 'La key no pertenece al corte editado de este trabajo'
  }
  return null
}

export function parseStartJob(body: unknown): Parsed<NormalizedStart> {
  const record = asRecord(body)
  if (!record) return { ok: false, error: 'El cuerpo tiene que ser un objeto JSON' }
  const clientId = optionalText(record.clientId)
  if (!clientId) return { ok: false, error: 'Falta el cliente' }
  if (!UUID_RE.test(clientId)) return { ok: false, error: 'El cliente no es un id válido' }
  const title = optionalText(record.title)
  if (!title) return { ok: false, error: 'Falta el título del video' }
  if (title.length > 200) return { ok: false, error: 'El título es demasiado largo' }

  const phaseRaw = optionalText(record.phase) ?? 'edited'
  if (phaseRaw !== 'edited' && phaseRaw !== 'raw') {
    return { ok: false, error: 'phase tiene que ser edited o raw' }
  }
  const phase = phaseRaw as OperatorPhase

  const hook = optionalText(record.hook)
  if (hook && hook.length > 2000) return { ok: false, error: 'El gancho es demasiado largo' }
  const publishDate = optionalText(record.publishDate)
  if (publishDate && !validDate(publishDate)) return { ok: false, error: 'La fecha debe ser AAAA-MM-DD' }

  const driveRaw = optionalText(record.driveLink)
  const driveFileId = driveRaw ? parseDriveFileId(driveRaw) : null
  if (driveRaw && !driveFileId) return { ok: false, error: 'El link de Drive no es válido' }

  const fileName = optionalText(record.fileName)
  const contentType = optionalText(record.contentType)
  if (phase === 'raw' && (fileName || contentType)) {
    return {
      ok: false,
      error: 'El material crudo se adjunta con un link de Drive. El archivo editado se sube a Entregas.',
    }
  }
  if (phase === 'raw' && !driveFileId) {
    return { ok: false, error: 'El material crudo necesita un link de Drive.' }
  }
  if ((fileName && !contentType) || (!fileName && contentType)) {
    return { ok: false, error: 'fileName y contentType van juntos' }
  }
  if (contentType && !isAllowedVideoUploadType(contentType)) {
    return { ok: false, error: 'Tipo de archivo no permitido. Solo se aceptan videos (mp4, mov, webm, etc.).' }
  }

  return {
    ok: true,
    value: {
      clientId,
      title,
      hook,
      publishDate,
      driveFileId,
      driveViewLink: driveFileId ? driveViewLink(driveFileId) : null,
      phase,
      fileName,
      contentType,
    },
  }
}

export function isOperatorHold(idea: { status: string; theme?: string | null }): boolean {
  return idea.status === 'descartada' && idea.theme === OPERATOR_HOLD_THEME
}

export function ideaInsertForStart(input: NormalizedStart): Record<string, unknown> {
  const waitingForFile = input.phase === 'edited'
  const row: Record<string, unknown> = {
    client_id: input.clientId,
    content_type: 'R',
    title: input.title,
    hook: input.hook,
    status: waitingForFile ? 'descartada' : 'grabada',
    approval_status: 'pending',
    publish_date: input.publishDate,
    visual_brief: input.driveViewLink ? `Referencia en Drive: ${input.driveViewLink}` : null,
    theme: waitingForFile ? OPERATOR_HOLD_THEME : null,
  }
  return row
}

export function rawVideoInsert(ideaId: string, input: NormalizedStart): Record<string, unknown> | null {
  if (input.phase !== 'raw' || !input.driveFileId || !input.driveViewLink) return null
  return {
    idea_id: ideaId,
    kind: 'raw',
    name: input.title,
    drive_file_id: input.driveFileId,
    drive_view_link: input.driveViewLink,
    storage_provider: 'drive',
    status: 'uploaded',
    uploaded_by: null,
  }
}

export function isClosedForNewFile(idea: IdeaGate): boolean {
  if (isOperatorHold(idea)) return false
  if (idea.published_at || idea.status === 'publicada' || idea.status === 'descartada') return true
  if (idea.approval_status === 'approved') return true
  if (idea.metricool_post_id != null || idea.posted_at || idea.posting_started_at) return true
  return false
}

export function decideRegister(idea: IdeaGate): { ok: true; submitToReview: boolean } | { ok: false; error: string } {
  if (isClosedForNewFile(idea)) {
    return {
      ok: false,
      error: 'Este video ya está aprobado, publicado o cerrado. No se adjunta otro corte.',
    }
  }
  return { ok: true, submitToReview: idea.approval_status === 'pending' }
}

export function registerUpdate(idea: IdeaGate, nowIso: string): Record<string, unknown> | null {
  if (isClosedForNewFile(idea)) return null
  const patch: Record<string, unknown> = {}
  if (isOperatorHold(idea) || idea.status === 'idea' || idea.status === 'asignada' || idea.status === 'grabada') {
    patch.status = 'producida'
  }
  if (isOperatorHold(idea)) patch.theme = null
  if (idea.approval_status === 'pending') {
    patch.approval_status = 'submitted'
    patch.submitted_at = nowIso
  }
  return Object.keys(patch).length ? patch : null
}

export function editedVideoInsert(input: {
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
    storage_provider: 'entregas-r2',
    size_bytes: input.sizeBytes,
    mime_type: input.mimeType,
    uploaded_by: null,
    status: 'uploaded',
  }
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
    const fromKey = key?.match(/^entregas\/([^/]+)\/edited\/[^/]+$/)
    const scopedId = ideaId ?? optionalText(record.ideaId) ?? fromKey?.[1] ?? null
    const name = optionalText(record.name)
    const mimeType = optionalText(record.mimeType)
    const sizeBytes = record.sizeBytes
    if (!scopedId || !key || !name || !mimeType || typeof sizeBytes !== 'number') {
      return { ok: false, error: 'register necesita key, name, sizeBytes y mimeType' }
    }
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > OPERATOR_VIDEO_MAX_BYTES) {
      return { ok: false, error: 'El video debe pesar entre 1 byte y 2 GB.' }
    }
    if (!isAllowedVideoUploadType(mimeType)) {
      return { ok: false, error: 'Tipo de archivo no permitido. Solo se aceptan videos (mp4, mov, webm, etc.).' }
    }
    const keyError = assertEntregasEditedKey(scopedId, key)
    if (keyError) return { ok: false, error: keyError }
    return { ok: true, step: 'register', key, name, sizeBytes, mimeType }
  }
  return { ok: false, error: 'Paso de reintento no reconocido. Usa caption, upload o register.' }
}

export function parseListQuery(params: { get(name: string): string | null }): Parsed<{ clientId: string | null; limit: number }> {
  const clientRaw = params.get('clientId')?.trim() || ''
  if (clientRaw && !UUID_RE.test(clientRaw)) return { ok: false, error: 'El cliente no es un id válido' }
  const limitRaw = params.get('limit')
  let limit = 20
  if (limitRaw != null && limitRaw !== '') {
    const parsed = Number(limitRaw)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      return { ok: false, error: 'limit tiene que ser un entero entre 1 y 50' }
    }
    limit = parsed
  }
  return { ok: true, value: { clientId: clientRaw || null, limit } }
}

function oneClient(client: OperatorIdeaRow['client']): { id: string; name: string } | null {
  if (!client) return null
  return Array.isArray(client) ? client[0] ?? null : client
}

function activeVideos(videos: OperatorVideoRow[] | null): OperatorVideoRow[] {
  return (videos ?? []).filter((v) => v.status !== 'archived')
}

export function shapeOperatorJob(
  row: OperatorIdeaRow,
  extras?: {
    analysis?: { status: string; error_note?: string | null; visual_summary?: string | null } | null
    downloadUrl?: string | null
    /** Solo el corte editado vigente recibe la URL firmada. */
    downloadVideoId?: string | null
  },
): OperatorJobView {
  const videos = activeVideos(row.videos)
  const holding = isOperatorHold(row)
  const pipelineStage = ideaStage({
    status: row.status,
    approval_status: row.approval_status as IdeaApprovalStatus,
    generated_caption: row.generated_caption,
    published_at: row.published_at,
    hook: row.hook,
    visual_brief: row.visual_brief,
  } as IdeaWithPipeline)
  const stage = holding ? 'waiting' : pipelineStage
  const client = oneClient(row.client)
  const closed = isClosedForNewFile(row)
  const hasVideo = videos.length > 0
  const outputs: OperatorOutput[] = []
  for (const video of videos) {
    if (video.kind === 'edited') {
      outputs.push({
        kind: 'edited',
        label: video.name || 'Video editado',
        videoId: video.id,
        href:
          video.storage_provider === 'drive'
            ? video.drive_view_link
            : extras?.downloadVideoId === video.id
              ? extras.downloadUrl ?? null
              : null,
      })
    } else if (video.kind === 'raw') {
      outputs.push({
        kind: 'raw',
        label: video.name || 'Video crudo',
        videoId: video.id,
        href: video.drive_view_link,
      })
    }
    if (video.storage_provider === 'drive' && video.drive_view_link) {
      outputs.push({ kind: 'drive', label: 'Drive', videoId: video.id, href: video.drive_view_link })
    }
  }
  const draft = row.caption_draft?.trim() || null
  const generated = row.generated_caption?.trim() || null
  if (draft) outputs.push({ kind: 'caption_draft', label: 'Borrador de caption', text: draft })
  if (generated) outputs.push({ kind: 'caption', label: 'Caption', text: generated })
  if (row.metricool_post_id != null) {
    outputs.push({ kind: 'metricool', label: 'Metricool', text: String(row.metricool_post_id) })
  }
  const retryable: OperatorJobView['retryable'] = []
  if (hasVideo) retryable.push('caption')
  if (!closed) retryable.push('upload', 'register')
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: client?.name ?? '',
    title: row.title,
    hook: row.hook,
    status: row.status,
    approvalStatus: row.approval_status,
    stage,
    stageLabel: holding ? 'Esperando archivo' : ENTREGA_LABEL_ES[pipelineStage],
    publishDate: row.publish_date,
    publishedAt: row.published_at,
    caption: { draft, generated },
    metricool: { postId: row.metricool_post_id, postedAt: row.posted_at },
    videos,
    analysis: extras?.analysis
      ? {
          status: extras.analysis.status,
          errorNote: extras.analysis.error_note ?? null,
          hasVisualSummary: !!extras.analysis.visual_summary?.trim(),
        }
      : null,
    outputs,
    retryable,
    downloadUrl: extras?.downloadUrl ?? null,
  }
}

/** Select embebido. La pista del FK es obligatoria (PGRST201). */
export const OPERATOR_JOB_SELECT = [
  'id',
  'client_id',
  'title',
  'hook',
  'status',
  'approval_status',
  'publish_date',
  'published_at',
  'generated_caption',
  'caption_draft',
  'metricool_post_id',
  'posted_at',
  'posting_started_at',
  'visual_brief',
  'theme',
  'created_at',
  'client:clients!content_ideas_client_id_fkey(id, name)',
  'videos:content_idea_videos!content_idea_videos_idea_id_fkey(id, kind, status, storage_provider, name, drive_file_id, drive_view_link, mime_type, size_bytes, uploaded_at)',
].join(', ')
