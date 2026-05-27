import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Users, Clock, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MemberLoad {
  id: string
  full_name: string | null
  pending: number
  inProgress: number
  overdue: number
}

interface TeamWorkloadProps {
  members: MemberLoad[]
}

export function TeamWorkload({ members }: TeamWorkloadProps) {
  if (members.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Carga del Equipo</CardTitle>
          </div>
          <Link href="/team" className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2.5">
          {members.slice(0, 8).map((m) => {
            const total = m.pending + m.inProgress
            const initials = m.full_name
              ? m.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
              : '?'
            const firstName = m.full_name?.split(' ')[0] ?? 'Sin nombre'
            return (
              <Link
                key={m.id}
                href={`/team/${m.id}`}
                className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-muted/50 transition-colors group"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className={cn(
                    'text-[10px] font-semibold',
                    m.overdue > 0 ? 'bg-red-500/20 text-red-600' : 'bg-primary/10 text-primary'
                  )}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{firstName}</p>
                    <div className="flex items-center gap-1.5 ml-2">
                      {m.overdue > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-semibold">
                          <Clock className="h-2.5 w-2.5" />{m.overdue}
                        </span>
                      )}
                      <Badge variant="outline" className={cn(
                        'text-[10px] px-1.5 py-0',
                        total === 0 ? 'text-green-500 border-green-500/30' :
                        m.inProgress > 0 ? 'text-blue-500 border-blue-500/30' : 'text-muted-foreground'
                      )}>
                        {total === 0 ? 'Clear ✓' : `${total} task${total !== 1 ? 's' : ''}`}
                      </Badge>
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    {total > 0 ? (
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          m.overdue > 0 ? 'bg-red-400' : 'bg-blue-500'
                        )}
                        style={{ width: `${Math.min(100, Math.max(8, (m.inProgress / Math.max(total, 1)) * 100))}%` }}
                      />
                    ) : (
                      <div className="h-full bg-green-500/40 rounded-full w-full" />
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
