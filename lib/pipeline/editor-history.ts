import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'
import { driveThumbUrl } from '@/lib/utils/drive-link'
import {
  clientAssigneeId,
  ideaAssigneeId,
  isIdeaApproved,
  isInRevision,
  isRawReadyWork,
} from './editor-video-bank'

export type EditorHistoryBucket = 'revision' | 'bank' | 'approved'

export interface EditorHistoryItem {
  ideaId: string
  title: string
  clientName: string
  bucket: EditorHistoryBucket
  at: string | null
  ageDays: number | null
  thumbUrl: string | null
}

function belongsToEditor(idea: IdeaWithPipeline, editorId: string): boolean {
  return ideaAssigneeId(idea) === editorId || clientAssigneeId(idea) === editorId
}

function titleOf(idea: IdeaWithPipeline): string {
  return idea.title?.trim() || idea.hook?.trim() || 'Sin título'
}

const COVER_KIND: ContentIdeaVideo['kind'][] = ['edited', 'raw', 'broll']

export function coverUrlForIdea(idea: IdeaWithPipeline): string | null {
  const videos = idea.videos ?? []
  for (const kind of COVER_KIND) {
    const v = videos.find((x) => x.kind === kind && x.status !== 'archived' && x.status !== 'failed')
    if (!v) continue
    if (v.drive_thumb_url?.trim()) return v.drive_thumb_url.trim()
    if (v.storage_provider === 'drive' && v.drive_file_id) return driveThumbUrl(v.drive_file_id)
  }
  return null
}

/** Fecha + hora en PR y antigüedad. Ej: "7 ago 2026, 2:14 p.m. · 18d" */
export function formatHistoryWhen(
  iso: string | null | undefined,
  nowIso: string = new Date().toISOString(),
  timeZone = 'America/Puerto_Rico',
): string | null {
  if (!iso) return null
  const at = new Date(iso)
  const now = new Date(nowIso)
  if (!Number.isFinite(at.getTime()) || !Number.isFinite(now.getTime())) return null
  const date = new Intl.DateTimeFormat('es-PR', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(at)
  const days = Math.max(0, Math.round((now.getTime() - at.getTime()) / 86_400_000))
  return `${date} · ${days}d`
}

function daysBetween(from: string | null | undefined, now: number): number | null {
  if (!from) return null
  const ms = now - new Date(from).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.round(ms / 86_400_000))
}

export function buildEditorHistory(
  ideas: IdeaWithPipeline[],
  editorId: string,
  now: number = Date.now(),
): EditorHistoryItem[] {
  const items: EditorHistoryItem[] = []
  for (const idea of ideas) {
    if (idea.status === 'descartada') continue
    if (!belongsToEditor(idea, editorId)) continue
    const clientName = idea.client?.name?.trim() || 'Cliente'
    const title = titleOf(idea)
    const thumbUrl = coverUrlForIdea(idea)
    if (isInRevision(idea)) {
      items.push({
        ideaId: idea.id,
        title,
        clientName,
        bucket: 'revision',
        at: idea.submitted_at ?? idea.updated_at ?? idea.created_at,
        ageDays: daysBetween(idea.created_at, now),
        thumbUrl,
      })
      continue
    }
    if (isIdeaApproved(idea)) {
      const at = idea.approved_at ?? idea.published_at ?? idea.updated_at
      items.push({
        ideaId: idea.id,
        title,
        clientName,
        bucket: 'approved',
        at,
        ageDays: daysBetween(at, now),
        thumbUrl,
      })
      continue
    }
    if (isRawReadyWork(idea)) {
      items.push({
        ideaId: idea.id,
        title,
        clientName,
        bucket: 'bank',
        at: idea.created_at,
        ageDays: daysBetween(idea.created_at, now),
        thumbUrl,
      })
    }
  }
  const rank: Record<EditorHistoryBucket, number> = { revision: 0, bank: 1, approved: 2 }
  items.sort((a, b) => {
    if (a.bucket !== b.bucket) return rank[a.bucket] - rank[b.bucket]
    return (b.ageDays ?? 0) - (a.ageDays ?? 0)
  })
  return items
}

export function editorHistorySummary(items: EditorHistoryItem[]) {
  const revision = items.filter((i) => i.bucket === 'revision')
  const bank = items.filter((i) => i.bucket === 'bank')
  const approved = items.filter((i) => i.bucket === 'approved')
  const ages = revision.map((i) => i.ageDays).filter((n): n is number => n != null)
  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null
  return { revision, bank, approved, avgAgeDays: avgAge }
}
