import type { ContentIdeaVideo, IdeaWithPipeline, UserRole } from '@/lib/supabase/types'
import { clientCardColor } from '@/lib/utils/client-accent'

const LIVE = new Set<ContentIdeaVideo['status']>(['uploading', 'uploaded', 'processing'])
const SOURCE = new Set<ContentIdeaVideo['kind']>(['raw', 'broll'])

/** Tope de trabajo activo del editor: 2 videos a la vez. */
export const EDITOR_WIP_LIMIT = 2

export interface EditorBankAccess {
  role: UserRole | null
  userId: string | null
  ideaAssigneeId?: string | null
  clientAssigneeId?: string | null
  uploadedBy?: string | null
  /** Solo editor: si esta idea está en su set activo de 2. */
  inEditorWip?: boolean
}

export interface EditorBankFile {
  id: string
  name: string
  kind: 'raw' | 'broll'
  storageProvider: ContentIdeaVideo['storage_provider']
  driveViewLink: string | null
}

export interface EditorBankClip {
  ideaId: string
  title: string
  shootingNotes: string | null
  files: EditorBankFile[]
  queue: 'active' | 'waiting'
}

export interface EditorBankClient {
  clientId: string
  clientName: string
  logoUrl: string | null
  /** Hex estable (brand_colors.primary o hash del id). */
  cardColor: string
  /** Ideas de este cliente ya aprobadas o publicadas (campo real, no métrica nueva). */
  approvedCount: number
  clips: EditorBankClip[]
}

export interface EditorBankResolvedMarks {
  logos?: Record<string, string | null>
  brandColors?: Record<string, string | null>
}

export interface EditorBankRow {
  editorId: string | null
  editorName: string
  clients: EditorBankClient[]
}

export function canSeeAllEditorBanks(role: UserRole | null | undefined): boolean {
  return role === 'owner' || role === 'supervisor'
}

export function canAccessEditorBank(access: EditorBankAccess): boolean {
  if (!access.role) return false
  if (canSeeAllEditorBanks(access.role)) return true
  if (!access.userId) return false
  if (access.role === 'editor' || access.role === 'team_member') {
    return access.ideaAssigneeId === access.userId || access.clientAssigneeId === access.userId
  }
  return false
}

export function canDownloadOrPreviewRaw(access: EditorBankAccess): boolean {
  if (access.userId && access.uploadedBy && access.uploadedBy === access.userId) return true
  if (!canAccessEditorBank(access)) return false
  if ((access.role === 'editor' || access.role === 'team_member') && access.inEditorWip === false) {
    return false
  }
  return true
}

export function ideaAssigneeId(idea: IdeaWithPipeline): string | null {
  return idea.assignee?.id ?? null
}

export function clientAssigneeId(idea: IdeaWithPipeline): string | null {
  const client = idea.client as { assigned_to?: string | null } | null | undefined
  return client?.assigned_to ?? null
}

export function sourceFiles(videos: ContentIdeaVideo[] | null | undefined): EditorBankFile[] {
  return (videos ?? [])
    .filter((v) => SOURCE.has(v.kind) && LIVE.has(v.status))
    .map((v) => ({
      id: v.id,
      name: v.name,
      kind: v.kind as 'raw' | 'broll',
      storageProvider: v.storage_provider,
      driveViewLink: v.drive_view_link,
    }))
}

export function isIdeaApproved(idea: Pick<IdeaWithPipeline, 'approval_status' | 'status' | 'published_at'>): boolean {
  return idea.approval_status === 'approved' || idea.status === 'publicada' || !!idea.published_at
}

export function isRawReadyWork(idea: IdeaWithPipeline): boolean {
  if (idea.status === 'descartada' || isIdeaApproved(idea)) return false
  return sourceFiles(idea.videos).length > 0
}

export function filterIdeasForEditorBank(
  ideas: IdeaWithPipeline[],
  viewer: { role: UserRole | null; userId: string | null },
): IdeaWithPipeline[] {
  return ideas.filter((idea) =>
    canAccessEditorBank({
      role: viewer.role,
      userId: viewer.userId,
      ideaAssigneeId: ideaAssigneeId(idea),
      clientAssigneeId: clientAssigneeId(idea),
    }),
  )
}

function belongsToEditor(idea: IdeaWithPipeline, userId: string): boolean {
  return ideaAssigneeId(idea) === userId || clientAssigneeId(idea) === userId
}

/** Las 2 ideas crudas más antiguas, aún no aprobadas, de este editor. */
export function editorWipIdeaIds(ideas: IdeaWithPipeline[], userId: string | null): Set<string> {
  if (!userId) return new Set()
  const ready = ideas
    .filter((idea) => belongsToEditor(idea, userId) && isRawReadyWork(idea))
    .sort((a, b) => {
      const byDate = (a.created_at ?? '').localeCompare(b.created_at ?? '')
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
    })
  return new Set(ready.slice(0, EDITOR_WIP_LIMIT).map((i) => i.id))
}

/** Filtro de asignación + tope de 2: los extras llegan sin ids de archivo. */
export function prepareIdeasForEditorBank(
  ideas: IdeaWithPipeline[],
  viewer: { role: UserRole | null; userId: string | null },
): IdeaWithPipeline[] {
  const assigned = filterIdeasForEditorBank(ideas, viewer)
  if (canSeeAllEditorBanks(viewer.role)) return assigned
  if (viewer.role !== 'editor' && viewer.role !== 'team_member') return assigned

  const active = editorWipIdeaIds(assigned, viewer.userId)
  return assigned.map((idea) => {
    if (active.has(idea.id)) return { ...idea, bankQueue: 'active' as const }
    if (isRawReadyWork(idea)) {
      return { ...idea, videos: [], bankQueue: 'waiting' as const }
    }
    return idea
  })
}

function editorOf(
  idea: IdeaWithPipeline,
  names: Record<string, string> = {},
): { id: string | null; name: string } {
  if (idea.assignee?.id) {
    return { id: idea.assignee.id, name: idea.assignee.full_name?.trim() || names[idea.assignee.id] || 'Editor' }
  }
  const fallback = clientAssigneeId(idea)
  if (fallback) {
    return { id: fallback, name: names[fallback] || 'Editor' }
  }
  return { id: null, name: 'Sin asignar' }
}

function ideaTitle(idea: IdeaWithPipeline): string {
  return idea.title?.trim() || idea.hook?.trim() || 'Sin título'
}

function clientKey(idea: IdeaWithPipeline): string | null {
  return idea.client?.id ?? idea.client_id ?? null
}

function countApprovedByClient(ideas: IdeaWithPipeline[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const idea of ideas) {
    const cid = clientKey(idea)
    if (!cid || idea.status === 'descartada') continue
    if (!isIdeaApproved(idea)) continue
    counts[cid] = (counts[cid] ?? 0) + 1
  }
  return counts
}

/** Una fila por editor de video; dentro, banco por cliente con clips que tienen crudo. */
function clientBrandPrimary(client: IdeaWithPipeline['client']): string | null {
  const colors = (client as { brand_colors?: { primary?: string | null } } | null | undefined)?.brand_colors
  return colors?.primary ?? null
}

export function groupEditorVideoBank(
  ideas: IdeaWithPipeline[],
  profileNames: Record<string, string> = {},
  resolved: EditorBankResolvedMarks = {},
): EditorBankRow[] {
  const approvedByClient = countApprovedByClient(ideas)
  const byEditor = new Map<string, EditorBankRow>()

  for (const idea of ideas) {
    if (idea.status === 'descartada') continue
    const waiting = idea.bankQueue === 'waiting'
    const files = waiting ? [] : sourceFiles(idea.videos)
    if (files.length === 0 && !waiting) continue

    const editor = editorOf(idea, profileNames)
    const key = editor.id ?? '__unassigned__'
    let row = byEditor.get(key)
    if (!row) {
      row = { editorId: editor.id, editorName: editor.name, clients: [] }
      byEditor.set(key, row)
    }

    const clientId = clientKey(idea)
    if (!clientId) continue
    let client = row.clients.find((c) => c.clientId === clientId)
    if (!client) {
      const brandColor = resolved.brandColors?.[clientId] ?? clientBrandPrimary(idea.client)
      client = {
        clientId,
        clientName: idea.client?.name ?? 'Cliente',
        logoUrl: resolved.logos?.[clientId] ?? idea.client?.logo_url ?? null,
        cardColor: clientCardColor({ id: clientId, brandColor }).dot,
        approvedCount: approvedByClient[clientId] ?? 0,
        clips: [],
      }
      row.clients.push(client)
    }
    client.clips.push({
      ideaId: idea.id,
      title: ideaTitle(idea),
      shootingNotes: idea.shooting_notes?.trim() || null,
      files,
      queue: waiting ? 'waiting' : 'active',
    })
  }

  const rows = Array.from(byEditor.values())
  for (const row of rows) {
    row.clients.sort((a, b) => a.clientName.localeCompare(b.clientName, 'es'))
  }
  rows.sort((a, b) => {
    if (a.editorId == null) return 1
    if (b.editorId == null) return -1
    return a.editorName.localeCompare(b.editorName, 'es')
  })
  return rows
}
