export type HistoryVideoKind = 'raw' | 'broll' | 'edited'

export interface HistoryVideoInput {
  id: string
  name: string
  kind: HistoryVideoKind
  status: string
  uploadedBy: string | null
  uploadedAt: string
  ideaId: string
}

export interface HistoryIdeaInput {
  id: string
  title: string | null
  createdBy: string | null
  createdAt: string
  recordingSessionId: string | null
  clientName: string | null
  sessionTitle: string | null
  sessionDate: string | null
}

export interface HistoryVideo {
  id: string
  name: string
  kind: HistoryVideoKind
  status: string
  uploadedAt: string
}

export interface HistoryIdea {
  ideaId: string
  title: string
  /** La creó quien graba y quedó ligada a la sesión: nació en la grabación. */
  additional: boolean
  videos: HistoryVideo[]
}

export interface VideographerHistorySession {
  sessionId: string | null
  sessionTitle: string | null
  sessionDate: string | null
  clientName: string
  ideas: HistoryIdea[]
}

const HIDDEN_STATUS = new Set(['archived'])

function titleOf(idea: HistoryIdeaInput | undefined): string {
  return idea?.title?.trim() || 'Sin título'
}

function isAdditional(personId: string, idea: HistoryIdeaInput | undefined): boolean {
  return !!idea && idea.createdBy === personId && !!idea.recordingSessionId
}

function latestAt(idea: HistoryIdea): string {
  return idea.videos[0]?.uploadedAt ?? ''
}

/**
 * Historial de quien graba.
 *
 * Entran solo los videos que ESA persona subió. Se agrupan por idea y por
 * sesión. Una idea es adicional cuando la creó ella y quedó en la sesión:
 * es lo que se agrega en el momento de la grabación, aunque el video todavía
 * no haya entrado. Una idea suya sin sesión no es adicional.
 */
export function buildVideographerHistory(
  personId: string,
  videos: HistoryVideoInput[],
  ideas: HistoryIdeaInput[],
): VideographerHistorySession[] {
  const ideaById = new Map(ideas.map((idea) => [idea.id, idea]))
  const videosByIdea = new Map<string, HistoryVideo[]>()

  for (const video of videos) {
    if (video.uploadedBy !== personId) continue
    if (HIDDEN_STATUS.has(video.status)) continue
    if (!video.ideaId) continue
    const list = videosByIdea.get(video.ideaId) ?? []
    list.push({
      id: video.id,
      name: video.name.trim() || 'Sin nombre',
      kind: video.kind,
      status: video.status,
      uploadedAt: video.uploadedAt,
    })
    videosByIdea.set(video.ideaId, list)
  }
  for (const list of videosByIdea.values()) {
    list.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  }

  const ideaIds = new Set(videosByIdea.keys())
  for (const idea of ideas) {
    if (isAdditional(personId, idea)) ideaIds.add(idea.id)
  }

  const groups = new Map<string, VideographerHistorySession>()
  for (const ideaId of ideaIds) {
    const meta = ideaById.get(ideaId)
    const sessionId = meta?.recordingSessionId ?? null
    const clientName = meta?.clientName?.trim() || 'Sin cliente'
    const key = sessionId ?? `none:${clientName}`
    let group = groups.get(key)
    if (!group) {
      group = {
        sessionId,
        sessionTitle: meta?.sessionTitle?.trim() || null,
        sessionDate: meta?.sessionDate ?? null,
        clientName,
        ideas: [],
      }
      groups.set(key, group)
    }
    group.ideas.push({
      ideaId,
      title: titleOf(meta),
      additional: isAdditional(personId, meta),
      videos: videosByIdea.get(ideaId) ?? [],
    })
  }

  for (const group of groups.values()) {
    group.ideas.sort((a, b) => {
      if (a.additional !== b.additional) return a.additional ? 1 : -1
      const byDate = latestAt(b).localeCompare(latestAt(a))
      if (byDate !== 0) return byDate
      return a.title.localeCompare(b.title, 'es')
    })
  }

  return [...groups.values()].sort((a, b) => {
    if (!a.sessionDate && !b.sessionDate) return a.clientName.localeCompare(b.clientName, 'es')
    if (!a.sessionDate) return 1
    if (!b.sessionDate) return -1
    const byDate = b.sessionDate.localeCompare(a.sessionDate)
    if (byDate !== 0) return byDate
    return a.clientName.localeCompare(b.clientName, 'es')
  })
}

export function videographerHistorySummary(sessions: VideographerHistorySession[]): {
  videos: number
  ideas: number
  additional: number
} {
  let videos = 0
  let ideas = 0
  let additional = 0
  for (const session of sessions) {
    for (const idea of session.ideas) {
      ideas += 1
      videos += idea.videos.length
      if (idea.additional) additional += 1
    }
  }
  return { videos, ideas, additional }
}

/** Fecha de sesión (YYYY-MM-DD) en el calendario, sin correrla al día anterior. */
export function formatSessionDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return new Intl.DateTimeFormat('es-PR', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
