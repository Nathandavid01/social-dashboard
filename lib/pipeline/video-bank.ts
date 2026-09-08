import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'
import { clientCardColor } from '@/lib/utils/client-accent'
import { clientAssigneeId, isIdeaApproved } from './editor-video-bank'
import { isClientBrollLibrary } from './banco-direct-upload'

/**
 * El banco visto como biblioteca de video: una carátula por crudo, agrupadas
 * por cliente. Responde tres preguntas de un vistazo — qué hay, cuántos tiene
 * cada cliente, y a quién le tocaría cada uno.
 *
 * La unidad de trabajo sigue siendo la IDEA (un corte por idea): reasignar
 * desde un video mueve su idea completa, con todos sus archivos.
 */

const LIVE = new Set<ContentIdeaVideo['status']>(['uploading', 'uploaded', 'processing'])

/** De dónde sale el editor: asignado a la idea, heredado del cliente, o nadie. */
export type AssignedVia = 'idea' | 'client' | null

export interface BankVideoTile {
  videoId: string
  ideaId: string
  /** `production_tasks.id` — lo que hay que tocar para reasignar. Null = no se puede. */
  productionTaskId: string | null
  title: string
  kind: 'raw' | 'broll'
  durationSec: number | null
  /** Claves de la tira de 5 escenas; el cliente las presigna al entrar en pantalla. */
  thumbKeys: string[]
  hasCover: boolean
  recordedBy: string | null
  uploadedAt: string | null
  clientId: string
  clientName: string
  editorId: string | null
  editorName: string | null
  assignedVia: AssignedVia
}

export interface BankClientRail {
  clientId: string
  clientName: string
  logoUrl: string | null
  cardColor: string
  postingDays: number[]
  videoCount: number
  editorId: string | null
  editorName: string | null
  assignedVia: AssignedVia
  videos: BankVideoTile[]
  /** B-roll del cliente: no se va cuando se aprueba un video. */
  brolls?: BankVideoTile[]
}

export interface VideoBank {
  rails: BankClientRail[]
  totals: { videos: number; clients: number; unassigned: number }
}

export interface VideoBankOptions {
  now?: number
  /** Nombres por id, para los editores que solo vienen como id (los heredados del cliente). */
  editorNames?: Record<string, string>
  recorderNames?: Record<string, string>
  onlyUnassigned?: boolean
}

function ideaTitle(idea: IdeaWithPipeline): string {
  return idea.title?.trim() || idea.hook?.trim() || 'Sin título'
}

function clientKey(idea: IdeaWithPipeline): string | null {
  return idea.client?.id ?? idea.client_id ?? null
}

function editorOf(
  idea: IdeaWithPipeline,
  names: Record<string, string>,
): { id: string | null; name: string | null; via: AssignedVia } {
  if (idea.assignee?.id) {
    return {
      id: idea.assignee.id,
      name: idea.assignee.full_name?.trim() || names[idea.assignee.id] || 'Editor',
      via: 'idea',
    }
  }
  const inherited = clientAssigneeId(idea)
  if (inherited) return { id: inherited, name: names[inherited] || 'Editor', via: 'client' }
  return { id: null, name: null, via: null }
}

function brandPrimary(client: IdeaWithPipeline['client']): string | null {
  return (client as { brand_colors?: { primary?: string | null } } | null | undefined)?.brand_colors?.primary ?? null
}

function postingDaysOf(client: IdeaWithPipeline['client']): number[] {
  const days = (client as { posting_days?: number[] } | null | undefined)?.posting_days
  return Array.isArray(days) ? days : []
}

function liveOf(idea: IdeaWithPipeline, kind: 'raw' | 'broll'): ContentIdeaVideo[] {
  return (idea.videos ?? []).filter((v) => v.kind === kind && LIVE.has(v.status))
}

function toTile(
  video: ContentIdeaVideo,
  idea: IdeaWithPipeline,
  rail: BankClientRail,
  editor: { id: string | null; name: string | null; via: AssignedVia },
  recorderNames: Record<string, string>,
): BankVideoTile {
  const thumbKeys = (video.thumb_keys ?? []).filter(Boolean)
  return {
    videoId: video.id,
    ideaId: idea.id,
    productionTaskId: idea.production_task_id ?? null,
    title: ideaTitle(idea),
    kind: video.kind as 'raw' | 'broll',
    durationSec: video.duration_sec ?? null,
    thumbKeys,
    hasCover: thumbKeys.length > 0,
    recordedBy: video.uploaded_by ? recorderNames[video.uploaded_by] ?? null : null,
    uploadedAt: video.uploaded_at ?? null,
    clientId: rail.clientId,
    clientName: rail.clientName,
    editorId: editor.id,
    editorName: editor.name,
    assignedVia: editor.via,
  }
}

export function buildVideoBank(ideas: IdeaWithPipeline[], options: VideoBankOptions = {}): VideoBank {
  const editorNames = options.editorNames ?? {}
  const recorderNames = options.recorderNames ?? {}

  const rails = new Map<string, BankClientRail>()

  for (const idea of ideas) {
    if (idea.status === 'descartada') continue

    const clientId = clientKey(idea)
    if (!clientId) continue

    const editor = editorOf(idea, editorNames)
    if (options.onlyUnassigned && editor.id) continue

    const pendingRaw = !isIdeaApproved(idea) && !isClientBrollLibrary(idea)
      ? liveOf(idea, 'raw')
      : []
    const broll = liveOf(idea, 'broll')
    if (pendingRaw.length === 0 && broll.length === 0) continue

    let rail = rails.get(clientId)
    if (!rail) {
      rail = {
        clientId,
        clientName: idea.client?.name ?? 'Cliente',
        logoUrl: idea.client?.logo_url ?? null,
        cardColor: clientCardColor({ id: clientId, brandColor: brandPrimary(idea.client) }).dot,
        postingDays: postingDaysOf(idea.client),
        videoCount: 0,
        editorId: editor.id,
        editorName: editor.name,
        assignedVia: editor.via,
        videos: [],
        brolls: [],
      }
      rails.set(clientId, rail)
    }

    rail.brolls ??= []
    for (const video of pendingRaw) {
      rail.videos.push(toTile(video, idea, rail, editor, recorderNames))
    }
    for (const video of broll) {
      rail.brolls.push(toTile(video, idea, rail, editor, recorderNames))
    }
    rail.videoCount = rail.videos.length + rail.brolls.length
  }

  const list = Array.from(rails.values())
  // Sin editor primero: son los que hay que resolver, no los que hay que mirar.
  list.sort((a, b) => {
    if (!a.editorId !== !b.editorId) return a.editorId ? 1 : -1
    if (a.videoCount !== b.videoCount) return b.videoCount - a.videoCount
    return a.clientName.localeCompare(b.clientName, 'es')
  })

  return {
    rails: list,
    totals: {
      videos: list.reduce((n, r) => n + r.videoCount, 0),
      clients: list.length,
      unassigned: list.filter((r) => !r.editorId).length,
    },
  }
}

export function emptyClientRail(client: { id: string; name: string }): BankClientRail {
  return {
    clientId: client.id,
    clientName: client.name,
    logoUrl: null,
    cardColor: clientCardColor({ id: client.id }).dot,
    postingDays: [],
    videoCount: 0,
    editorId: null,
    editorName: null,
    assignedVia: null,
    videos: [],
    brolls: [],
  }
}

export function railsWithEveryClient(
  rails: BankClientRail[],
  clients: Array<{ id: string; name: string }>,
): BankClientRail[] {
  if (clients.length === 0) return rails
  const byId = new Map(rails.map((r) => [r.clientId, r]))
  const out = clients.map((c) => byId.get(c.id) ?? emptyClientRail(c))
  for (const rail of rails) {
    if (!clients.some((c) => c.id === rail.clientId)) out.push(rail)
  }
  return out
}
