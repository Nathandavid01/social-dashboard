import { Video, Sparkles, Pencil, Upload, Send, Rocket, ClipboardList, ArrowRight, History } from 'lucide-react'
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
}

/** Fallback icon for unknown/legacy actions. */
export const FALLBACK_ACTION_ICON = History

/** Pure: the Spanish verb phrase for an action + its metadata. */
export function activityVerb(
  action: ContentIdeaActivityAction,
  metadata: Record<string, unknown> = {},
): string {
  return ACTION_META[action]?.verb(metadata) ?? 'realizó una acción'
}
