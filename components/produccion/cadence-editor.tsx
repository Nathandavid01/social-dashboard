'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { hasPermission } from '@/lib/auth/permissions'
import { upsertProductionSchedules } from '@/lib/actions/production'
import {
  cycleCadence,
  schedulesToDayMap,
  dayMapToSchedules,
  countCadence,
  type DayCadence,
} from '@/lib/utils/cadence-core'
import type { ProductionContentType } from '@/lib/supabase/types'

const DAYS = [
  { num: 1, label: 'Lun' },
  { num: 2, label: 'Mar' },
  { num: 3, label: 'Mié' },
  { num: 4, label: 'Jue' },
  { num: 5, label: 'Vie' },
  { num: 6, label: 'Sáb' },
  { num: 7, label: 'Dom' },
]

interface Props {
  clientId: string
  /** The client's current production_schedules rows. */
  initialSchedules: { day_of_week: number; content_type: ProductionContentType }[]
}

export function CadenceEditor({ clientId, initialSchedules }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { role } = useAuth()
  const canEdit = hasPermission(role, 'production.edit')

  const original = useMemo(() => schedulesToDayMap(initialSchedules), [initialSchedules])
  const originalDays = useMemo(() => Object.keys(original).map(Number), [original])
  const [map, setMap] = useState<Record<number, DayCadence>>(original)
  const [isPending, startTransition] = useTransition()

  const dirty = useMemo(() => {
    for (let d = 1; d <= 7; d++) {
      if ((map[d] ?? null) !== (original[d] ?? null)) return true
    }
    return false
  }, [map, original])

  const { total, reels, posts } = countCadence(map)

  function toggle(day: number) {
    if (!canEdit) return
    setMap((prev) => ({ ...prev, [day]: cycleCadence(prev[day] ?? null) }))
  }

  function save() {
    startTransition(async () => {
      const res = await upsertProductionSchedules(clientId, dayMapToSchedules(map), originalDays)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: 'Cadencia guardada', description: `${total} publicación${total === 1 ? '' : 'es'} / semana.` })
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((d) => {
          const t = map[d.num] ?? null
          return (
            <button
              key={d.num}
              type="button"
              onClick={() => toggle(d.num)}
              disabled={!canEdit}
              data-testid={`day-${d.num}`}
              aria-label={`${d.label}: ${t === 'R' ? 'Reel' : t === 'P' ? 'Post' : 'sin publicación'}`}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border py-2 text-xs transition-colors',
                canEdit ? 'cursor-pointer hover:border-primary/50' : 'cursor-default',
                t ? 'border-transparent' : 'border-dashed border-border',
              )}
            >
              <span className="font-medium text-muted-foreground">{d.label}</span>
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                  t === 'R' && 'bg-indigo-600 text-white',
                  t === 'P' && 'bg-amber-500 text-zinc-900',
                  !t && 'text-muted-foreground/40',
                )}
              >
                {t ?? '·'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> / semana ·{' '}
          <span className="font-medium text-indigo-600">{reels} reels</span> ·{' '}
          <span className="font-medium text-amber-600">{posts} posts</span>
          {canEdit && <span className="ml-2 text-muted-foreground/70">Toca un día para alternar R / P.</span>}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={save}
            disabled={!dirty || isPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              dirty && !isPending
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-muted text-muted-foreground',
            )}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Guardar
          </button>
        )}
      </div>
    </div>
  )
}
