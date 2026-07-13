import {
  Video,
  Sparkles,
  Pencil,
  Upload,
  Send,
  Rocket,
  ClipboardList,
  ArrowRight,
  History,
  Link as LinkIcon,
  CheckCircle2,
  RotateCcw,
  MessageSquare,
} from 'lucide-react'
import type { ContentIdeaActivityAction } from '@/lib/supabase/types'

/**
 * Spanish label + icon + tone for each content-idea activity action. Shared by
 * the per-idea timeline and the per-person activity log so both read the same.
 * `verb(metadata)` is pure → unit-testable without rendering.
 */
export const ACTION_META: Record<
  ContentIdeaActivityAction,
  { icon: typeof Video; tone: string; verb: (m: Record<string, unknown>) => string }
> = {
  recorded: { icon: Video, tone: 'text-cyan-500', verb: () => 'grabó el video' },
  caption_generated: {
    icon: Sparkles,
    tone: 'text-primary',
    verb: (m) => `generó el caption con IA${m.platform ? ` (${m.platform})` : ''}`,
  },
  caption_saved: { icon: Pencil, tone: 'text-purple-500', verb: () => 'editó el caption' },
  video_uploaded: {
    icon: Upload,
    tone: 'text-orange-500',
    verb: (m) => `subió video${m.kind ? ` (${m.kind})` : ''}`,
  },
  published: { icon: Send, tone: 'text-green-600', verb: () => 'marcó como publicado' },
  posted_to_metricool: {
    icon: Rocket,
    tone: 'text-sky-500',
    verb: (m) =>
      `publicó en Metricool${Array.isArray(m.platforms) ? ` (${(m.platforms as string[]).join(', ')})` : ''}`,
  },
  assigned: { icon: ClipboardList, tone: 'text-blue-500', verb: () => 'asignó a producción' },
  status_changed: {
    icon: ArrowRight,
    tone: 'text-zinc-500',
    verb: (m) => `cambió el estado${m.status ? ` a “${m.status}”` : ''}`,
  },
  // Client decisions from the public review link. These have no `user_id`, so the
  // timeline renders them without an author — the verb has to say who acted.
  sent_to_client: { icon: LinkIcon, tone: 'text-indigo-500', verb: () => 'envió el video al cliente' },
  // Inserted by the submit_client_review RPC (migration 0042) — it was already
  // being written with no label, so it fell back to the generic icon.
  client_reviewed: {
    icon: MessageSquare,
    tone: 'text-indigo-500',
    verb: (m) => `el cliente votó${m.decision === 'approved' ? ': aprobado' : m.decision === 'rejected' ? ': rechazado' : ''}`,
  },
  approved_by_client: {
    icon: CheckCircle2,
    tone: 'text-green-600',
    verb: () => 'el cliente aprobó el video',
  },
  client_requested_changes: {
    icon: RotateCcw,
    tone: 'text-amber-600',
    verb: () => 'el cliente pidió cambios',
  },
}

/** Fallback icon for unknown/legacy actions. */
export const FALLBACK_ACTION_ICON = History

/**
 * Actions performed by the CLIENT (or by the system on their behalf) from the
 * public review link. They carry no `user_id`, so a timeline must NOT prefix
 * them with an author — their verb already names the actor ("el cliente aprobó
 * el video"). Without this they'd render as "Alguien el cliente aprobó…".
 */
const CLIENT_ACTIONS = new Set<ContentIdeaActivityAction>([
  'client_reviewed',
  'approved_by_client',
  'client_requested_changes',
])

export function isClientAction(action: ContentIdeaActivityAction): boolean {
  return CLIENT_ACTIONS.has(action)
}

/** Pure: the Spanish verb phrase for an action + its metadata. */
export function activityVerb(
  action: ContentIdeaActivityAction,
  metadata: Record<string, unknown> = {},
): string {
  return ACTION_META[action]?.verb(metadata) ?? 'realizó una acción'
}
