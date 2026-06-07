import type { ApprovedIdea } from '@/lib/actions/idea-feedback-types'
import type { ContentIdeaType } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2 } from 'lucide-react'

const TYPE_LABEL: Record<ContentIdeaType, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }

/**
 * Read-only list of approved ideas for editors/designers. Presentational only —
 * the page fetches and gates access.
 */
export function ApprovedIdeasList({ ideas }: { ideas: ApprovedIdea[] }) {
  if (ideas.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed text-center text-muted-foreground">
        <CheckCircle2 className="mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">Aún no hay ideas aprobadas.</p>
        <p className="text-xs">Cuando el equipo apruebe ideas en el Lab, aparecerán aquí.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ideas.map((idea) => (
        <div key={idea.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h3 className="min-w-0 truncate font-semibold">{idea.title}</h3>
            <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {idea.objective && (
                <Badge variant="outline" className="text-[10px]">
                  {idea.objective}
                  {idea.funnel_stage ? ` · ${idea.funnel_stage}` : ''}
                </Badge>
              )}
              <Badge variant="secondary">{TYPE_LABEL[idea.content_type] ?? idea.content_type}</Badge>
            </div>
          </div>
          {idea.client?.name && (
            <p className="mt-1 text-xs font-medium text-muted-foreground">{idea.client.name}</p>
          )}
          <p className="mt-2 text-sm font-medium">{idea.hook}</p>
          <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
            {idea.visual_brief && (
              <div>
                <dt className="font-semibold text-foreground">Brief visual</dt>
                <dd>{idea.visual_brief}</dd>
              </div>
            )}
            {idea.caption_angle && (
              <div>
                <dt className="font-semibold text-foreground">Ángulo del caption</dt>
                <dd>{idea.caption_angle}</dd>
              </div>
            )}
          </dl>
          {idea.hashtags_suggestion && (
            <p className="mt-2 text-[11px] text-primary">{idea.hashtags_suggestion}</p>
          )}
        </div>
      ))}
    </div>
  )
}
