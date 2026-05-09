'use client'

import { useState } from 'react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns'
import type { ContentEvent, Client } from '@/lib/supabase/types'
import { CalendarEventChip } from './calendar-event'
import { AddEventDialog } from './add-event-dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WeeklyCalendarProps {
  initialEvents: ContentEvent[]
  clients: Pick<Client, 'id' | 'name'>[]
}

export function WeeklyCalendar({ initialEvents, clients }: WeeklyCalendarProps) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  function openAddDialog(date: Date) {
    const localISO = format(date, "yyyy-MM-dd'T'09:00")
    setSelectedDate(localISO)
    setDialogOpen(true)
  }

  return (
    <>
      {/* Week navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-48 text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
          Today
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mt-4">
        {days.map((day) => {
          const isToday = isSameDay(day, new Date())
          const dayEvents = initialEvents.filter((e) =>
            isSameDay(new Date(e.scheduled_at), day)
          )

          return (
            <div
              key={day.toISOString()}
              className="flex flex-col min-h-32 rounded-lg border border-border bg-card overflow-hidden"
            >
              {/* Day header */}
              <div
                className={cn(
                  'flex items-center justify-between px-2 py-1.5 border-b border-border',
                  isToday && 'bg-primary/10'
                )}
              >
                <div>
                  <p className="text-xs text-muted-foreground">{format(day, 'EEE')}</p>
                  <p className={cn('text-sm font-semibold', isToday && 'text-primary')}>
                    {format(day, 'd')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => openAddDialog(day)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Events */}
              <div className="flex-1 p-1 space-y-1 overflow-y-auto">
                {dayEvents.map((event) => (
                  <CalendarEventChip key={event.id} event={event} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <AddEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={selectedDate}
        clients={clients}
      />
    </>
  )
}
