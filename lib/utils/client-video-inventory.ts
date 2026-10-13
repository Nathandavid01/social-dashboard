import { isPublishedIdea, type PoolStateInput } from './client-pool-state'

export type InventoryVideo = { kind?: string | null; status?: string | null; drive_file_id?: string | null; mime_type?: string | null; name?: string | null }
export type InventoryIdea = PoolStateInput & { id: string; client_id: string; content_type?: string | null; videos?: InventoryVideo[] | null }
export type InventoryClient = { id: string; name: string; status: string; assigned_to?: string | null; edit_mode?: string | null; metricool_blog_id?: string | null }
export type InventoryPost = { id: number | string; draft?: boolean; autoPublish?: boolean; media?: unknown[]; providers?: { status: string }[] }
export type ClientVideoInventoryRow = { clientId: string; clientName: string; status: string; editors: string[]; edited: number; raw: number; scheduled: number | null; unverified: number }

function videoUrl(value: unknown): boolean {
  return typeof value === 'string' && /\.(mp4|mov|m4v|webm|mkv)(?:[?#]|$)/i.test(value)
}

function usableVideo(file: InventoryVideo): boolean {
  if (!file.drive_file_id || ['archived', 'failed', 'uploading'].includes(file.status ?? '')) return false
  if (file.mime_type) return file.mime_type.startsWith('video/')
  return videoUrl(file.drive_file_id) || videoUrl(file.name)
}

function postHasVideo(post: InventoryPost): boolean {
  return (post.media ?? []).some((media) => {
    if (videoUrl(media)) return true
    if (!media || typeof media !== 'object') return false
    const item = media as Record<string, unknown>
    return [item.url, item.src, item.mediaUrl, item.publicUrl].some(videoUrl)
  })
}

function published(post: InventoryPost): boolean {
  return (post.providers ?? []).some((provider) => provider.status === 'PUBLISHED')
}

function scheduled(post: InventoryPost): boolean {
  return !published(post) && !post.draft && post.autoPublish !== false
    && (post.providers ?? []).some((provider) => provider.status === 'PENDING')
}

/** One idea is one piece; scheduled is a subset of edited when its file exists. */
export function buildClientVideoInventory(input: {
  clients: InventoryClient[]
  ideas: InventoryIdea[]
  profiles: { id: string; full_name: string | null }[]
  assignments: { client_id: string; editor_id: string }[]
  /** null means the calendar could not be verified, never a zero. */
  calendar: Record<string, InventoryPost[] | null>
}): ClientVideoInventoryRow[] {
  const names = new Map(input.profiles.map((profile) => [profile.id, profile.full_name?.trim() || 'Editor sin nombre']))
  const ideasByClient = new Map<string, InventoryIdea[]>()
  for (const idea of input.ideas) ideasByClient.set(idea.client_id, [...(ideasByClient.get(idea.client_id) ?? []), idea])
  return [...input.clients].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((client) => {
    const editorIds = new Set([client.assigned_to, ...input.assignments.filter((a) => a.client_id === client.id).map((a) => a.editor_id)].filter((id): id is string => !!id))
    const editors = [...editorIds].map((id) => names.get(id) ?? 'Editor sin nombre')
    if (client.edit_mode === 'ai') editors.unshift('IA')
    const posts = input.calendar[client.id]
    const byPost = new Map((posts ?? []).map((post) => [String(post.id), post]))
    const scheduledIds = new Set((posts ?? []).filter((post) => scheduled(post) && postHasVideo(post)).map((post) => String(post.id)))
    let edited = 0, raw = 0, unverified = 0
    const seen = new Set<string>()
    for (const idea of ideasByClient.get(client.id) ?? []) {
      if (seen.has(idea.id)) continue
      seen.add(idea.id)
      if (idea.status === 'descartada' || isPublishedIdea(idea)) continue
      const files = (idea.videos ?? []).filter(usableVideo)
      const hasEdited = files.some((file) => file.kind === 'edited')
      const hasRaw = files.some((file) => file.kind === 'raw')
      if (!hasEdited && !hasRaw) continue
      const linked = idea.metricool_post_id != null ? byPost.get(String(idea.metricool_post_id)) : null
      if (linked && published(linked)) continue
      if ((idea.metricool_post_id != null && !linked) || (idea.posted_at && !linked)) {
        unverified++
        continue
      }
      if (linked && scheduled(linked)) scheduledIds.add(String(linked.id))
      if (hasEdited) edited++
      else if (hasRaw && !(linked && scheduled(linked))) raw++
    }
    return { clientId: client.id, clientName: client.name, status: client.status, editors, edited, raw,
      scheduled: client.metricool_blog_id && posts == null ? null : scheduledIds.size, unverified }
  })
}
