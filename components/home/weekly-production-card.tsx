import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Video, Scissors, MessageSquareText, Clapperboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeeklyProductionStatus } from '@/lib/utils/weekly-production'

export function WeeklyProductionCard({ status }: { status: WeeklyProductionStatus }) {
  const { total } = status
  const gates = [
    { key: 'grabados', label: 'Grabados', icon: Video, done: status.grabados, bar: 'bg-cyan-500', tone: 'text-cyan-500' },
    { key: 'editados', label: 'Editados', icon: Scissors, done: status.editados, bar: 'bg-orange-500', tone: 'text-orange-500' },
    { key: 'captions', label: 'Con captions', icon: MessageSquareText, done: status.conCaptions, bar: 'bg-purple-500', tone: 'text-purple-500' },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <Clapperboard className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Producción de esta semana</span>
          </CardTitle>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {total} video{total === 1 ? '' : 's'} planeado{total === 1 ? '' : 's'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay videos vinculados a grabaciones de esta semana.
          </p>
        ) : (
          gates.map((g) => {
            const pct = Math.round((g.done / total) * 100)
            const pending = total - g.done
            const Icon = g.icon
            const done = pending === 0
            return (
              <div key={g.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className={cn('flex items-center gap-1.5 font-medium', g.tone)}>
                    <Icon className="h-3.5 w-3.5" /> {g.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {g.done}/{total}
                    {done ? ' ✓' : ` · faltan ${pending}`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full transition-all duration-700 ease-out', done ? 'bg-green-500' : g.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
