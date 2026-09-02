import type { ContentIdeaVideo, IdeaWithPipeline, UserRole, UserStatus } from '@/lib/supabase/types'
import { ROLE_LABEL } from '@/lib/auth/permissions'
import { clientCardColor } from '@/lib/utils/client-accent'
import { deadlineStatus, todayISOInTimeZone, type DeadlineStatus } from '@/lib/utils/deadlines'

const URGENCY_RANK: Record<DeadlineStatus, number> = { none: 0, future: 1, 'due-soon': 2, overdue: 3 }
const NATE_TZ = 'America/Puerto_Rico'

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
  hook: string | null
  visualBrief: string | null
  shootingNotes: string | null
  recordedBy: string | null
  recordedAt: string | null
  deadline: string | null
  location: string | null
  contentType: string | null
  /** Este clip ocupa uno de los 2 espacios del editor. */
  yours: boolean
  files: EditorBankFile[]
  queue: 'active' | 'waiting'
}

export interface EditorBankNextSlot {
  ideaId: string
  title: string
  clientName: string
}

export interface EditorBankClient {
  clientId: string
  clientName: string
  logoUrl: string | null
  /** Hex estable (brand_colors.primary o hash del id). */
  cardColor: string
  /** Ideas de este cliente ya aprobadas o publicadas (campo real, no métrica nueva). */
  approvedCount: number
  /** Crudos sin aprobar que siguen en el banco de este cliente. */
  remainingInBank: number
  inRevision: number
  postingDays: number[]
  clips: EditorBankClip[]
  resources: EditorBankResources
}

/** Dónde están los recursos de un cliente: siempre hay un enlace, aunque sea "ninguno · subir". */
export interface EditorBankResources {
  logosCount: number
  logosHref: string
  brollCount: number
  brollHref: string
  /** Carpeta externa (Drive) registrada como enlace en los activos del cliente. */
  brollFolderUrl: string | null
}

export interface EditorBankResolvedMarks {
  /** Activos por cliente: logos subidos y carpeta externa de B-rolls (client_assets). */
  assets?: Record<string, { logos: number; brollFolderUrl: string | null }>
  logos?: Record<string, string | null>
  brandColors?: Record<string, string | null>
  /** WIP dinámico por editor (editorWipLimitFor); sin entrada → EDITOR_WIP_LIMIT. */
  wipLimits?: Record<string, number>
  /** % de aprobación (0–100) por editor; sin entrada → null (sin historial). */
  approvalRates?: Record<string, number | null>
}

export interface EditorBankRow {
  editorId: string | null
  editorName: string
  clients: EditorBankClient[]
  remainingInBank: number
  /** Videos en los 2 espacios activos ahora. */
  nowCount: number
  /** Cortes en Revisión (submitted / revision_needed / producida). */
  inRevision: number
  /** Tope de espacios activos de ESTE editor (WIP dinámico; base EDITOR_WIP_LIMIT). */
  wipLimit: number
  /** % de aprobación (0–100) de este editor, o null sin historial. */
  approvalRate: number | null
  nextSlots: EditorBankNextSlot[]
}

/** Owner y supervisor: quién opera el banco (no son filas de edición). */
export interface BankAdmin {
  id: string
  name: string
  email: string | null
  role: 'owner' | 'supervisor'
  roleLabel: string
}

export function listBankAdmins(
  profiles: Array<{
    id: string
    full_name?: string | null
    email?: string | null
    role?: UserRole | null
    status?: UserStatus | null
  }>,
): BankAdmin[] {
  return profiles
    .filter((p) => (p.status ?? 'active') === 'active' && (p.role === 'owner' || p.role === 'supervisor'))
    .map((p) => ({
      id: p.id,
      name: p.full_name?.trim() || p.email || 'Sin nombre',
      email: p.email ?? null,
      role: p.role as 'owner' | 'supervisor',
      roleLabel: ROLE_LABEL[p.role as 'owner' | 'supervisor'],
    }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'owner' ? -1 : 1
      return a.name.localeCompare(b.name, 'es')
    })
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

/**
 * Descarga/preview por tipo de archivo: el b-roll es un pool GLOBAL — cualquier
 * rol autenticado del equipo lo puede bajar para reusar en cualquier edición.
 * El raw sigue scoped a la asignación + WIP (canDownloadOrPreviewRaw).
 */
export function canDownloadIdeaVideo(access: EditorBankAccess, kind: string | undefined): boolean {
  if (kind === 'broll') return !!access.role
  return canDownloadOrPreviewRaw(access)
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

export function isInRevision(idea: Pick<IdeaWithPipeline, 'approval_status' | 'status' | 'published_at'>): boolean {
  if (idea.status === 'descartada' || isIdeaApproved(idea)) return false
  return idea.approval_status === 'submitted'
    || idea.approval_status === 'revision_needed'
    || idea.status === 'producida'
}

export function isRawReadyWork(idea: IdeaWithPipeline): boolean {
  if (idea.status === 'descartada' || isIdeaApproved(idea) || isInRevision(idea)) return false
  return sourceFiles(idea.videos).length > 0
}

function ideaUrgency(idea: IdeaWithPipeline, today: string): number {
  return URGENCY_RANK[deadlineStatus(idea.deadline, idea.status, today, idea.published_at)]
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

/** Los 2 espacios: un video del cliente más urgente, luego del siguiente. */
export function editorWipIdeaIds(
  ideas: IdeaWithPipeline[],
  userId: string | null,
  today: string = todayISOInTimeZone(NATE_TZ),
  limit: number = EDITOR_WIP_LIMIT,
): Set<string> {
  if (!userId) return new Set()
  const ready = ideas.filter((idea) => belongsToEditor(idea, userId) && isRawReadyWork(idea))
  const byClient = new Map<string, IdeaWithPipeline[]>()
  for (const idea of ready) {
    const key = clientKey(idea) ?? idea.id
    const list = byClient.get(key) ?? []
    list.push(idea)
    byClient.set(key, list)
  }
  const sortIdeas = (a: IdeaWithPipeline, b: IdeaWithPipeline) => {
    const u = ideaUrgency(b, today) - ideaUrgency(a, today)
    if (u !== 0) return u
    const byDate = (a.created_at ?? '').localeCompare(b.created_at ?? '')
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
  }
  for (const list of byClient.values()) list.sort(sortIdeas)
  const clients = Array.from(byClient.values()).sort((a, b) => {
    const ua = Math.max(...a.map((i) => ideaUrgency(i, today)))
    const ub = Math.max(...b.map((i) => ideaUrgency(i, today)))
    if (ub !== ua) return ub - ua
    return sortIdeas(a[0], b[0])
  })
  const picked: IdeaWithPipeline[] = []
  for (const list of clients) {
    if (picked.length >= limit) break
    picked.push(list[0])
  }
  if (picked.length < limit) {
    const have = new Set(picked.map((i) => i.id))
    picked.push(...ready.filter((i) => !have.has(i.id)).sort(sortIdeas).slice(0, limit - picked.length))
  }
  return new Set(picked.map((i) => i.id))
}

/** Filtro de asignación + tope de 2: los extras llegan sin ids de archivo. */
export function prepareIdeasForEditorBank(
  ideas: IdeaWithPipeline[],
  viewer: { role: UserRole | null; userId: string | null },
  opts: { wipLimit?: number } = {},
): IdeaWithPipeline[] {
  const assigned = filterIdeasForEditorBank(ideas, viewer)
  if (canSeeAllEditorBanks(viewer.role)) return assigned
  if (viewer.role !== 'editor' && viewer.role !== 'team_member') return assigned

  const active = editorWipIdeaIds(assigned, viewer.userId, undefined, opts.wipLimit ?? EDITOR_WIP_LIMIT)
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

function emptyRow(editor: { id: string | null; name: string }, wipLimit: number, approvalRate: number | null): EditorBankRow {
  return {
    editorId: editor.id,
    editorName: editor.name,
    clients: [],
    remainingInBank: 0,
    nowCount: 0,
    inRevision: 0,
    wipLimit,
    approvalRate,
    nextSlots: [],
  }
}

function emptyClient(
  clientId: string,
  idea: IdeaWithPipeline,
  approvedByClient: Record<string, number>,
  resolved: EditorBankResolvedMarks,
): EditorBankClient {
  const brandColor = resolved.brandColors?.[clientId] ?? clientBrandPrimary(idea.client)
  return {
    clientId,
    clientName: idea.client?.name ?? 'Cliente',
    logoUrl: resolved.logos?.[clientId] ?? idea.client?.logo_url ?? null,
    cardColor: clientCardColor({ id: clientId, brandColor }).dot,
    approvedCount: approvedByClient[clientId] ?? 0,
    remainingInBank: 0,
    inRevision: 0,
    postingDays: Array.isArray((idea.client as { posting_days?: number[] } | null)?.posting_days)
      ? ((idea.client as { posting_days?: number[] }).posting_days ?? [])
      : [],
    clips: [],
    resources: {
      logosCount: resolved.assets?.[clientId]?.logos ?? 0,
      logosHref: `/clients/${clientId}?tab=assets`,
      brollCount: 0,
      brollHref: `/clients/${clientId}?tab=assets`,
      brollFolderUrl: resolved.assets?.[clientId]?.brollFolderUrl ?? null,
    },
  }
}

/** B-rolls vivos del cliente (videos kind broll), para el conteo del enlace. */
function countLiveBroll(videos: ContentIdeaVideo[] | null | undefined): number {
  return (videos ?? []).filter((v) => v.kind === 'broll' && LIVE.has(v.status)).length
}

export function groupEditorVideoBank(
  ideas: IdeaWithPipeline[],
  profileNames: Record<string, string> = {},
  resolved: EditorBankResolvedMarks = {},
  recorderNames: Record<string, string> = {},
): EditorBankRow[] {
  const approvedByClient = countApprovedByClient(ideas)
  const byEditor = new Map<string, EditorBankRow>()

  const ensure = (idea: IdeaWithPipeline) => {
    const editor = editorOf(idea, profileNames)
    const key = editor.id ?? '__unassigned__'
    let row = byEditor.get(key)
    if (!row) {
      row = emptyRow(editor, (editor.id && resolved.wipLimits?.[editor.id]) || EDITOR_WIP_LIMIT, (editor.id ? resolved.approvalRates?.[editor.id] : null) ?? null)
      byEditor.set(key, row)
    }
    const clientId = clientKey(idea)
    if (!clientId) return { row, client: null as EditorBankClient | null }
    let client = row.clients.find((c) => c.clientId === clientId)
    if (!client) {
      client = emptyClient(clientId, idea, approvedByClient, resolved)
      row.clients.push(client)
    }
    return { row, client }
  }

  for (const idea of ideas) {
    if (idea.status === 'descartada') continue
    const { row, client } = ensure(idea)
    if (!client) continue
    client.resources.brollCount += countLiveBroll(idea.videos)
    if (isInRevision(idea)) {
      row.inRevision += 1
      client.inRevision += 1
      continue
    }

    const waiting = idea.bankQueue === 'waiting'
    const files = waiting ? [] : sourceFiles(idea.videos)
    if (files.length === 0 && !waiting) continue

    const uploaderId = idea.videos.find((v) => v.uploaded_by)?.uploaded_by ?? null
    const recordedAt = idea.videos.find((v) => v.uploaded_at)?.uploaded_at ?? idea.recording_date
    const session = idea.recording_session
    const location = session?.location?.trim() || session?.location_address?.trim() || null
    client.clips.push({
      ideaId: idea.id,
      title: ideaTitle(idea),
      hook: idea.hook?.trim() || null,
      visualBrief: idea.visual_brief?.trim() || null,
      shootingNotes: idea.shooting_notes?.trim() || null,
      recordedBy: uploaderId ? (recorderNames[uploaderId] ?? null) : null,
      recordedAt: recordedAt ?? null,
      deadline: idea.deadline ?? null,
      location,
      contentType: idea.content_type ?? null,
      yours: !waiting,
      files,
      queue: waiting ? 'waiting' : 'active',
    })
  }

  const rows = Array.from(byEditor.values())
  for (const row of rows) {
    row.clients = row.clients.filter((c) => c.clips.length > 0 || c.inRevision > 0)
    for (const client of row.clients) {
      client.remainingInBank = client.clips.length
      row.remainingInBank += client.remainingInBank
      // Siempre un destino: la carpeta externa si la hay; si no, el B-roll global
      // cuando el cliente tiene; si no, los activos del cliente para subirlos.
      const r = client.resources
      r.brollHref = r.brollFolderUrl ?? (r.brollCount > 0 ? '#global-broll' : `/clients/${client.clientId}?tab=assets`)
    }
    row.nextSlots = row.clients.flatMap((c) =>
      c.clips
        .filter((clip) => clip.queue === 'active')
        .map((clip) => ({ ideaId: clip.ideaId, title: clip.title, clientName: c.clientName })),
    )
    row.nowCount = row.nextSlots.length
    row.clients.sort((a, b) => a.clientName.localeCompare(b.clientName, 'es'))
  }
  rows.sort((a, b) => {
    if (a.editorId == null) return 1
    if (b.editorId == null) return -1
    return a.editorName.localeCompare(b.editorName, 'es')
  })
  return rows.filter((row) => row.remainingInBank > 0 || row.inRevision > 0)
}
