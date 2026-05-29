'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns'
import type { CalendarItem, CalendarItemType, Client, Profile } from '@/lib/supabase/types'
import { AddEventDialog } from './add-event-dialog'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Plus, Video, Send, Camera, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WeeklyCalendarProps {
  initialItems: CalendarItem[]
  clients: Pick<Client, 'id' | 'name'>[]
  profiles: Pick<Profile, 'id' | 'full_name'>[]
}

const TYPE_META: Record<CalendarItemType, { label: string; chip: string; dot: string; icon: typeof Video }> = {
  grabacion:   { label: 'Grabación',   chip: 'bg-rose-500/10 text-rose-600 border-rose-500/30',     dot: 'bg-rose-500',   icon: Camera },
  publicacion: { label: 'Publicación', chip: 'bg-green-500/10 text-green-600 border-green-500/30',   dot: 'bg-green-500',  icon: CalendarCheck },
  posting:     { label: 'Posting',     chip: 'bg-blue-500/10 text-blue-600 border-blue-500/30',      dot: 'bg-blue-500',   icon: Send },
  sesion:      { label: 'Sesión',      chip: 'bg-purple-500/10 text-purple-600 border-purple-500/30', dot: 'bg-purple-500', icon: Video },
}
const ALL_TYPES = Object.keys(TYPE_META) as CalendarItemType[]

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
}

export function WeeklyCalendar({ initialItems, clients, profiles }: WeeklyCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')

  const [clientFilter, setClientFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [activeTypes, setActiveTypes] = useState<Set<CalendarItemType>>(new Set(ALL_TYPES))

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  function openAddDialog(date: Date) {
    setSelectedDate(format(date, "yyyy-MM-dd'T'09:00"))
    setDialogOpen(true)
  }

  function toggleType(t: CalendarItemType) {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const filtered = useMemo(() => {
    return initialItems.filter((it) => {
      if (!activeTypes.has(it.type)) return false
      if (clientFilter !== 'all' && it.clientId !== clientFilter) return false
      if (assigneeFilter === 'none' && it.assignee) return false
      if (assigneeFilter !== 'all' && assigneeFilter !== 'none' && it.assignee?.id !== assigneeFilter) return false
      return true
    })
  }, [initialItems, activeTypes, clientFilter, assigneeFilter])

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_TYPES.map((t) => {
          const meta = TYPE_META[t]
          const on = activeTypes.has(t)
          const Icon = meta.icon
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              aria-pressed={on}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                on ? meta.chip : 'border-border bg-muted/40 text-muted-foreground opacity-60',
              )}
            >
              <Icon className="h-3 w-3" /> {meta.label}
            </button>
          )
        })}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Persona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las personas</SelectItem>
              <SelectItem value="none">Sin asignar</SelectItem>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Week navigation */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-48 text-center text-sm font-medium">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
          Hoy
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="mt-4 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isToday = isSameDay(day, new Date())
          const dayItems = filtered
            .filter((it) => isSameDay(new Date(it.date), day))
            .sort((a, b) => a.date.localeCompare(b.date))

          return (
            <div key={day.toISOString()} className="flex min-h-32 flex-col overflow-hidden rounded-lg border border-border bg-card">
              <div className={cn('flex items-center justify-between border-b border-border px-2 py-1.5', isToday && 'bg-primary/10')}>
                <div>
                  <p className="text-xs text-muted-foreground">{format(day, 'EEE')}</p>
                  <p className={cn('text-sm font-semibold', isToday && 'text-primary')}>{format(day, 'd')}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openAddDialog(day)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto p-1">
                {dayItems.map((it) => <CalendarItemChip key={it.id} item={it} />)}
              </div>
            </div>
          )
        })}
      </div>

      <AddEventDialog open={dialogOpen} onOpenChange={setDialogOpen} defaultDate={selectedDate} clients={clients} />
    </>
  )
}

function CalendarItemChip({ item }: { item: CalendarItem }) {
  const meta = TYPE_META[item.type]
  const body = (
    <div className={cn('rounded-md border px-1.5 py-1 text-[11px] leading-tight', meta.chip)}>
      <div className="flex items-center gap-1">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
        <span className="truncate font-medium">{item.title}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] opacity-80">
        <span className="truncate">{item.clientName ?? meta.label}</span>
        {item.assignee && (
          <span className="shrink-0" title={item.assignee.full_name ?? ''}>{initials(item.assignee.full_name)}</span>
        )}
      </div>
    </div>
  )
  return item.href ? <Link href={item.href} className="block hover:opacity-80">{body}</Link> : body
}
