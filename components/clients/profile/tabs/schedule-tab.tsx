import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarClock, Clock, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { CadenceEditor } from '@/components/produccion/cadence-editor'
import type { Client, ProductionContentType } from '@/lib/supabase/types'
import { getClientPostedDates } from '@/lib/utils/client-posted-dates'
import {
  computeScheduleSlots,
  summarizeSlots,
  SLOT_STATUS_META,
  type ScheduleSlot,
} from '@/lib/utils/posting-schedule'
import { dayLabelsShort } from '@/lib/utils/posting-cadence'
import { PostingTimeEditor } from '../posting-time-editor'

function startOfWeekMon(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

function localIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-PR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export async function ScheduleTab({ client }: { client: Client }) {
  const postingDays = client.posting_days ?? []

  const supabase = await createClient()
  const { data: cadenceRows } = await supabase
    .from('production_schedules')
    .select('day_of_week, content_type')
    .eq('client_id', client.id)
  const cadence = (cadenceRows ?? []) as { day_of_week: number; content_type: ProductionContentType }[]

  const ref = new Date()
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999)
  const weekStart = startOfWeekMon(ref)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const postedDates = await getClientPostedDates(
    client.id,
    client.metricool_blog_id,
    monthStart.toISOString(),
    monthEnd.toISOString(),
  )

  const slots = computeScheduleSlots({
    postingDays,
    postingTime: client.posting_time,
    postingSchedule: client.posting_schedule,
    rangeStart: monthStart,
    rangeEnd: monthEnd,
    postedDates,
    ref,
  })

  const monthSummary = summarizeSlots(slots)
  const weekStartIso = localIso(weekStart)
  const weekEndIso = localIso(weekEnd)
  const weekSlots = slots.filter((s) => s.date >= weekStartIso && s.date <= weekEndIso)
  const weekSummary = summarizeSlots(weekSlots)

  const groups: { label: string; slots: ScheduleSlot[] }[] = [
    { label: 'Antes de esta semana', slots: slots.filter((s) => s.date < weekStartIso) },
    { label: 'Esta semana', slots: weekSlots },
    { label: 'Más adelante este mes', slots: slots.filter((s) => s.date > weekEndIso) },
  ].filter((g) => g.slots.length > 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> Cadencia de producción
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Días que este cliente debe postear y el tipo de cada día —{' '}
            <span className="font-medium text-indigo-600">R = Reel</span> ·{' '}
            <span className="font-medium text-amber-600">P = Post</span>.
          </p>
          <CadenceEditor clientId={client.id} initialSchedules={cadence} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span className="truncate">Calendario de posting · {ref.toLocaleDateString('es-PR', { month: 'long' })}</span>
          </CardTitle>
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <SummaryChip status="hecho" n={monthSummary.hecho} />
            <SummaryChip status="pendiente" n={monthSummary.pendiente} />
            <SummaryChip status="falto" n={monthSummary.falto} />
          </div>
        </CardHeader>
        <CardContent>
          {postingDays.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este cliente no tiene días de posting configurados. Fíjalos en la pestaña <strong>Resumen</strong> para ver
              su calendario.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Esta semana:{' '}
                <strong className="tabular-nums text-foreground">{weekSummary.hecho}</strong> de{' '}
                <strong className="tabular-nums text-foreground">{weekSummary.total}</strong> publicaciones
                {weekSummary.falto > 0 && (
                  <span className="text-red-500"> · {weekSummary.falto} faltó</span>
                )}
              </p>
              {groups.map((g) => (
                <div key={g.label} className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h4>
                  <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                    {g.slots.map((s) => {
                      const meta = SLOT_STATUS_META[s.status]
                      return (
                        <li key={s.date} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot)} />
                            <span className="text-sm capitalize">{fmtDate(s.date)}</span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {s.time ?? '—'}
                            </span>
                          </div>
                          <span className={cn('shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', meta.badge)}>
                            {meta.label}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Horas de publicación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PostingTimeEditor
            clientId={client.id}
            postingDays={postingDays}
            initialTime={client.posting_time}
            initialSchedule={client.posting_schedule ?? {}}
          />
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

function SummaryChip({ status, n }: { status: keyof typeof SLOT_STATUS_META; n: number }) {
  const meta = SLOT_STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
      <strong className="tabular-nums text-foreground">{n}</strong>
      <span className="text-muted-foreground">{meta.label}</span>
    </span>
  )
}
