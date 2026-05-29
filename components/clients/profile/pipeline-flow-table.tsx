import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { ContentIdea } from '@/lib/supabase/types'

const STAGES = [
  { key: 'idea', label: 'Idea' },
  { key: 'grabado', label: 'Grabado' },
  { key: 'editado', label: 'Editado' },
  { key: 'caption', label: 'Caption' },
  { key: 'publicado', label: 'Publicado' },
] as const

function stageDone(idea: ContentIdea, key: string): boolean {
  switch (key) {
    case 'idea':
      return true
    case 'grabado':
      return ['grabada', 'producida', 'publicada'].includes(idea.status)
    case 'editado':
      return ['producida', 'publicada'].includes(idea.status)
    case 'caption':
      return !!idea.generated_caption
    case 'publicado':
      return idea.status === 'publicada'
    default:
      return false
  }
}

/** Per-client production flow: one row per video (with date), one column per process stage. */
export function PipelineFlowTable({ ideas }: { ideas: ContentIdea[] }) {
  if (ideas.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Sin videos en el pipeline todavía.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Flujo de producción — {ideas.length} video{ideas.length === 1 ? '' : 's'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Video</th>
                <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                {STAGES.map((s) => (
                  <th key={s.key} className="px-2 py-2.5 text-center font-medium">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {ideas.map((idea) => (
                <tr key={idea.id} className="transition-colors hover:bg-muted/40">
                  <td className="max-w-[220px] px-4 py-3 font-medium">
                    <span className="line-clamp-1">{idea.title}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(idea.created_at)}
                  </td>
                  {STAGES.map((s) => {
                    const done = stageDone(idea, s.key)
                    return (
                      <td key={s.key} className="px-2 py-3 text-center">
                        <span
                          className={cn(
                            'inline-grid h-6 w-6 place-items-center rounded-full',
                            done ? 'bg-green-500/15 text-green-600' : 'text-muted-foreground/30',
                          )}
                        >
                          {done ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
