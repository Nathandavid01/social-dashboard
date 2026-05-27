'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'

interface DayData {
  label: string
  completed: number
  date: string
}

interface WeekActivityProps {
  days: DayData[]
}

export function WeekActivity({ days }: WeekActivityProps) {
  const max = Math.max(...days.map((d) => d.completed), 1)
  const total = days.reduce((s, d) => s + d.completed, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Tareas Completadas esta Semana
          </CardTitle>
          <span className="text-xs text-muted-foreground">{total} total</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end gap-2 h-20">
          {days.map((day) => {
            const height = day.completed === 0 ? 4 : Math.max(8, (day.completed / max) * 72)
            const isToday = day.date === new Date().toISOString().slice(0, 10)
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-xs font-medium text-foreground">
                  {day.completed > 0 ? day.completed : ''}
                </span>
                <div
                  className={`w-full rounded-t transition-all ${isToday ? 'bg-primary' : day.completed > 0 ? 'bg-primary/40' : 'bg-muted'}`}
                  style={{ height: `${height}px` }}
                />
                <span className={`text-[10px] ${isToday ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                  {day.label}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
