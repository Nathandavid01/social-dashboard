import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentIdeaActivity } from '@/lib/supabase/types'
import { ACTION_META, FALLBACK_ACTION_ICON, isClientAction } from '@/lib/utils/activity-labels'

export function IdeaActivityTimeline({ activities }: { activities: ContentIdeaActivity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay actividad registrada para esta idea.</p>
  }

  return (
    <ul className="space-y-3">
      {activities.map((a) => {
        const meta = ACTION_META[a.action] ?? {
          icon: FALLBACK_ACTION_ICON,
          tone: 'text-muted-foreground',
          verb: () => a.action,
        }
        const Icon = meta.icon
        const verb = meta.verb(a.metadata ?? {})
        // Client actions have no author — the verb names the actor itself.
        const byClient = isClientAction(a.action)
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
                {byClient ? (
                  <span className="font-medium">
                    {verb.charAt(0).toUpperCase() + verb.slice(1)}
                  </span>
                ) : (
                  <>
                    <span className="font-medium">{a.user?.full_name ?? 'Alguien'}</span>{' '}
                    <span className="text-muted-foreground">{verb}</span>
                  </>
                )}
              </p>
              {when && <p className="text-xs text-muted-foreground">{when}</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
