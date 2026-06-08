'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Task, Profile } from '@/lib/supabase/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { TaskStatusBadge } from '@/components/operations/task-status-badge'
import { RoleSelector } from './role-selector'
import { Users, AlertTriangle, CheckSquare, Clock, ArrowRight, Film } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Member extends Profile {
  tasks: Task[]
  overdue: number
  /** How many video files this person has uploaded, by kind. */
  uploads?: { raw: number; broll: number; edited: number; total: number }
}

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const priorityLabel = (p: number) => p === 1 ? '↑ Alta' : p === 2 ? '→ Media' : '↓ Baja'
const priorityColor = (p: number) => p === 1 ? 'text-red-500' : p === 2 ? 'text-yellow-500' : 'text-muted-foreground'

function MemberCard({ member }: { member: Member }) {
  const [expanded, setExpanded] = useState(false)
  const inProgress = member.tasks.filter((t) => t.status === 'in_progress').length
  const pending = member.tasks.filter((t) => t.status === 'pending').length
  const blocked = member.tasks.filter((t) => t.status === 'blocked').length
  const total = member.tasks.length

  const displayTasks = expanded ? member.tasks : member.tasks.slice(0, 4)

  return (
    <Card className={cn(member.overdue > 0 && 'border-orange-200', 'hover:border-primary/40 transition-colors')}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Link href={`/team/${member.id}`} className="shrink-0">
            <Avatar className="h-10 w-10 hover:ring-2 hover:ring-primary/50 transition-all">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                {initials(member.full_name)}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/team/${member.id}`} className="hover:text-primary transition-colors">
              <p className="font-semibold text-sm truncate">{member.full_name ?? member.email}</p>
            </Link>
            {member.title ? (
              <p className="text-xs text-foreground/80 truncate">{member.title}</p>
            ) : null}
            <div className="mt-1">
              <RoleSelector
                userId={member.id}
                userName={member.full_name ?? member.email}
                currentRole={member.role}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {member.overdue > 0 && (
              <Badge variant="outline" className="text-orange-500 border-orange-300 bg-orange-50 text-xs gap-1 shrink-0">
                <AlertTriangle className="h-3 w-3" />
                {member.overdue}
              </Badge>
            )}
            <Link href={`/team/${member.id}`} className="text-muted-foreground hover:text-primary transition-colors">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Mini workload bar */}
        <div className="flex gap-2 text-xs mt-2 flex-wrap">
          {inProgress > 0 && (
            <span className="flex items-center gap-1 text-blue-500">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {inProgress} en progreso
            </span>
          )}
          {pending > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              {pending} pendiente{pending !== 1 ? 's' : ''}
            </span>
          )}
          {blocked > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {blocked} bloqueada{blocked !== 1 ? 's' : ''}
            </span>
          )}
          {total === 0 && (
            <span className="text-green-500">Todo al día ✓</span>
          )}
        </div>

        {total > 0 && (
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.min(100, (inProgress / Math.max(total, 1)) * 100)}%` }}
            />
          </div>
        )}

        {/* Videos uploaded by this person (raw / b-roll / edited) */}
        {member.uploads && member.uploads.total > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <Film className="h-3 w-3" /> Videos subidos
            </span>
            <span>Raw {member.uploads.raw}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>B-roll {member.uploads.broll}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-foreground">Editados {member.uploads.edited}</span>
            <span className="ml-auto rounded-full bg-muted px-1.5 font-semibold tabular-nums text-foreground">{member.uploads.total}</span>
          </div>
        )}
      </CardHeader>

      {total > 0 && (
        <CardContent className="pt-0 space-y-1.5">
          {displayTasks.map((task) => {
            const nowIso = new Date().toISOString()
            const isOverdue = task.status !== 'completed' && task.due_at && task.due_at < nowIso
            return (
              <div key={task.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors">
                <TaskStatusBadge status={task.status} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-medium leading-snug', isOverdue && 'text-orange-500')}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {(task.client as { name?: string } | null)?.name && (
                      <span className="text-[10px] text-muted-foreground">
                        @ {(task.client as { name: string }).name}
                      </span>
                    )}
                    {task.due_at && (
                      <span className={cn('text-[10px] flex items-center gap-0.5', isOverdue ? 'text-orange-500 font-semibold' : 'text-muted-foreground')}>
                        <Clock className="h-2.5 w-2.5" />
                        {isOverdue ? 'VENCIDA · ' : ''}
                        {formatDistanceToNow(new Date(task.due_at), { addSuffix: true, locale: es })}
                      </span>
                    )}
                    <span className={cn('text-[10px] ml-auto', priorityColor(task.priority))}>
                      {priorityLabel(task.priority)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {member.tasks.length > 4 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full text-xs text-primary hover:underline text-center py-1"
            >
              {expanded ? 'Ver menos' : `+ ${member.tasks.length - 4} tareas más`}
            </button>
          )}
        </CardContent>
      )}
    </Card>
  )
}

interface TeamOverviewProps {
  members: Member[]
}

export function TeamOverview({ members }: TeamOverviewProps) {
  const total = members.reduce((s, m) => s + m.tasks.length, 0)
  const totalOverdue = members.reduce((s, m) => s + m.overdue, 0)
  const totalInProgress = members.reduce((s, m) => s + m.tasks.filter((t) => t.status === 'in_progress').length, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Carga del Equipo
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {members.length} miembros · {total} tareas abiertas · {totalInProgress} en progreso
          {totalOverdue > 0 && ` · ${totalOverdue} vencidas`}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Miembros', value: members.length, icon: Users, color: 'text-primary' },
          { label: 'Tareas Abiertas', value: total, icon: CheckSquare, color: 'text-blue-500' },
          { label: 'En Progreso', value: totalInProgress, icon: Clock, color: 'text-yellow-500' },
          { label: 'Vencidas', value: totalOverdue, icon: AlertTriangle, color: totalOverdue > 0 ? 'text-orange-500' : 'text-green-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={cn('h-8 w-8 p-1.5 rounded-lg bg-muted shrink-0', color)} />
              <div>
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Member cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      {members.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="mx-auto h-12 w-12 opacity-20 mb-4" />
          <p>No team members found</p>
        </div>
      )}
    </div>
  )
}
