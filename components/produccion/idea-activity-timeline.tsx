import { Video, Sparkles, Pencil, Upload, Send, Rocket, ClipboardList, ArrowRight, History } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentIdeaActivity, ContentIdeaActivityAction } from '@/lib/supabase/types'

const ACTION_META: Record<
  ContentIdeaActivityAction,
  { icon: typeof Video; tone: string; verb: (m: Record<string, unknown>) => string }
> = {
  recorded:          { icon: Video,         tone: 'text-cyan-500',   verb: () => 'grabó el video' },
  caption_generated: { icon: Sparkles,      tone: 'text-primary',    verb: (m) => `generó el caption con IA${m.platform ? ` (${m.platform})` : ''}` },
  caption_saved:     { icon: Pencil,        tone: 'text-purple-500', verb: () => 'editó el caption' },
  video_uploaded:    { icon: Upload,        tone: 'text-orange-500', verb: (m) => `subió video${m.kind ? ` (${m.kind})` : ''}` },
  published:         { icon: Send,          tone: 'text-green-600',  verb: () => 'marcó como publicado' },
  posted_to_metricool: { icon: Rocket,      tone: 'text-sky-500',    verb: (m) => `publicó en Metricool${Array.isArray(m.platforms) ? ` (${(m.platforms as string[]).join(', ')})` : ''}` },
  assigned:          { icon: ClipboardList, tone: 'text-blue-500',   verb: () => 'asignó a producción' },
  status_changed:    { icon: ArrowRight,    tone: 'text-zinc-500',   verb: (m) => `cambió el estado${m.status ? ` a “${m.status}”` : ''}` },
}

export function IdeaActivityTimeline({ activities }: { activities: ContentIdeaActivity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay actividad registrada para esta idea.</p>
  }

  return (
    <ul className="space-y-3">
      {activities.map((a) => {
        const meta = ACTION_META[a.action] ?? {
          icon: History,
          tone: 'text-muted-foreground',
          verb: () => a.action,
        }
        const Icon = meta.icon
        const who = a.user?.full_name ?? 'Alguien'
        let when = ''
        try {
          when = formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: es })
        } catch {
          when = ''
        }
        return (
          <li key={a.id} className="flex items-start gap-2.5 text-sm">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tone}`} />
            <div className="min-w-0 flex-1">
              <p className="leading-snug">
                <span className="font-medium">{who}</span>{' '}
                <span className="text-muted-foreground">{meta.verb(a.metadata ?? {})}</span>
              </p>
              {when && <p className="text-xs text-muted-foreground">{when}</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
