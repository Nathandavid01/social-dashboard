'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, HelpCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  weeklyPlanHeadline,
  weeklyPlanSubline,
  type WeeklyPlan,
  type WeeklyPlanItem,
} from '@/lib/utils/weekly-plan-core'

function ClientRow({ item }: { item: WeeklyPlanItem }) {
  return (
    <li>
      <Link
        href={`/clients/${item.clientId}`}
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 transition hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.clientName}</p>
          <p className="truncate text-xs text-muted-foreground">{item.reason}</p>
        </div>
        {item.weeklyCadence > 0 && (
          <Badge variant="outline" className="shrink-0 whitespace-nowrap text-xs font-normal">
            {item.weeklyCadence}/semana
          </Badge>
        )}
      </Link>
    </li>
  )
}

function Section({
  icon: Icon,
  title,
  items,
  tone,
  collapsible = false,
}: {
  icon: typeof AlertTriangle
  title: string
  items: WeeklyPlanItem[]
  tone: string
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(!collapsible)
  if (items.length === 0) return null

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        disabled={!collapsible}
        className="flex w-full items-center gap-1.5 text-left text-sm font-semibold disabled:cursor-default"
      >
        <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
        <span>{title}</span>
        <span className="font-normal text-muted-foreground">({items.length})</span>
        {collapsible && (
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {open && (
        <ul className="space-y-1.5">
          {items.map((i) => (
            <ClientRow key={i.clientId} item={i} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * "Esta semana toca" — the short list of clients that actually need a human now.
 *
 * The healthy clients are collapsed, not hidden: a client you can't see is a
 * client you can't sanity-check. But the default view is the SHORT list, which is
 * the whole point — a Monday should show 8 clients, not 50.
 */
export function WeeklyPlanView({ plan }: { plan: WeeklyPlan }) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-balance">
          {weeklyPlanHeadline(plan)}
        </h2>
        {plan.total > 0 && (
          <p className="text-sm text-muted-foreground">{weeklyPlanSubline(plan)}</p>
        )}
      </header>

      {plan.tocanCount === 0 && plan.sinCadencia.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          Todos los clientes tienen contenido en banco. Nada urgente.
        </p>
      ) : (
        <div className="space-y-5">
          <Section
            icon={AlertTriangle}
            title="Urgente — se quedan sin contenido"
            items={plan.urgentes}
            tone="text-red-600 dark:text-red-400"
          />
          <Section
            icon={CalendarClock}
            title="Esta semana"
            items={plan.estaSemana}
            tone="text-amber-600 dark:text-amber-400"
          />
          {/* Collapsed by default — these are the ones you can ignore today. */}
          <Section
            icon={CheckCircle2}
            title="Pueden esperar"
            items={plan.puedenEsperar}
            tone="text-green-600 dark:text-green-400"
            collapsible
          />
          {/* Not "fine" — unknowable. Worth fixing, so it's visible but set apart. */}
          <Section
            icon={HelpCircle}
            title="Sin cadencia configurada"
            items={plan.sinCadencia}
            tone="text-muted-foreground"
            collapsible
          />
        </div>
      )}
    </div>
  )
}
