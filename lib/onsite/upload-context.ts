import type { ContentIdeaVideoStatus } from '@/lib/supabase/types'

const LIVE_RAW = new Set(['uploading', 'uploaded', 'processing'])

export interface OnsiteIdeaFootage {
  ideaId: string
  title: string
  rawCount: number
}

export interface OnsiteSessionUpload {
  videoId: string
  name: string
  status: ContentIdeaVideoStatus
  ideaId: string
  ideaTitle: string
}

export interface OnsiteUploadContext {
  sessionId: string
  clientName: string
  sessionTitle: string
  sessionDate: string
  ideas: OnsiteIdeaFootage[]
  uploads: OnsiteSessionUpload[]
}

export interface OnsiteRawVideoRow {
  id: string
  name: string
  status: string
  kind: string
  idea_id: string
}

export function footageLabel(rawCount: number): 'Ya hay crudo' | 'Falta crudo' {
  return rawCount > 0 ? 'Ya hay crudo' : 'Falta crudo'
}

export function uploadStatusLabel(status: string): string {
  switch (status) {
    case 'uploaded':
      return 'Subido'
    case 'uploading':
      return 'Subiendo'
    case 'processing':
      return 'Procesando'
    case 'failed':
      return 'Falló'
    case 'archived':
      return 'Archivado'
    default:
      return status
  }
}

export function uploadTargetSummary(input: {
  clientName: string
  sessionTitle: string
  ideaCount: number
}): string {
  const session = input.sessionTitle.trim() || 'Sesión'
  const ideas = input.ideaCount === 1 ? '1 idea' : `${input.ideaCount} ideas`
  return `${input.clientName} · ${session} · ${ideas}`
}

function isLiveRaw(video: OnsiteRawVideoRow): boolean {
  return video.kind === 'raw' && LIVE_RAW.has(video.status)
}

export function buildOnsiteUploadContext(input: {
  sessionId: string
  clientName: string
  sessionTitle: string
  sessionDate: string
  shots: Array<{ id: string; title: string }>
  videos: OnsiteRawVideoRow[]
}): OnsiteUploadContext {
  const ideaIds = new Set(input.shots.map((s) => s.id))
  const titles = new Map(input.shots.map((s) => [s.id, s.title]))
  const ideas = input.shots.map((shot) => ({
    ideaId: shot.id,
    title: shot.title,
    rawCount: input.videos.filter((v) => v.idea_id === shot.id && isLiveRaw(v)).length,
  }))
  const uploads = input.videos
    .filter((v) => ideaIds.has(v.idea_id) && isLiveRaw(v))
    .map((v) => ({
      videoId: v.id,
      name: v.name,
      status: v.status as ContentIdeaVideoStatus,
      ideaId: v.idea_id,
      ideaTitle: titles.get(v.idea_id) ?? 'Sin título',
    }))

  return {
    sessionId: input.sessionId,
    clientName: input.clientName,
    sessionTitle: input.sessionTitle,
    sessionDate: input.sessionDate,
    ideas,
    uploads,
  }
}

export function mergeInFlightUploads(
  uploads: OnsiteSessionUpload[],
  inFlight: Array<{ id: string; fileName: string; ideaId: string; phase: string }>,
  ideaTitles: Map<string, string>,
): OnsiteSessionUpload[] {
  const known = new Set(uploads.map((u) => u.videoId))
  const extra: OnsiteSessionUpload[] = []
  for (const item of inFlight) {
    if (!ideaTitles.has(item.ideaId) || known.has(item.id)) continue
    if (item.phase === 'duplicado' || item.phase === 'cancelado') continue
    extra.push({
      videoId: item.id,
      name: item.fileName,
      status: item.phase === 'listo' ? 'uploaded' : item.phase === 'error' ? 'failed' : 'uploading',
      ideaId: item.ideaId,
      ideaTitle: ideaTitles.get(item.ideaId) ?? 'Sin título',
    })
  }
  return [...uploads, ...extra]
}

export function withRawCount<T extends { id: string }>(
  shots: T[],
  ideas: OnsiteIdeaFootage[],
): Array<T & { rawCount: number }> {
  const counts = new Map(ideas.map((i) => [i.ideaId, i.rawCount]))
  return shots.map((shot) => ({ ...shot, rawCount: counts.get(shot.id) ?? 0 }))
}
