import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Completion {
  id: string
  title: string
  updated_at: string
  client: { name: string } | null
  assignee: { full_name: string | null } | null
}

interface RecentCompletionsProps {
  completions: Completion[]
}

export function RecentCompletions({ completions }: RecentCompletionsProps) {
  if (completions.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <CardTitle className="text-sm">Completadas Recientemente</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {completions.slice(0, 8).map((c) => (
          <div key={c.id} className="flex items-start gap-2.5 text-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="leading-snug line-clamp-1 font-medium">{c.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {c.client && (
                  <span className="text-xs text-primary">{c.client.name}</span>
                )}
                {c.assignee?.full_name && (
                  <span className="text-xs text-muted-foreground">— {c.assignee.full_name}</span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDate(c.updated_at)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
