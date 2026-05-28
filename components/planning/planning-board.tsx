'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Calendar, Lightbulb, RefreshCcw, CheckCircle2, Search,
  ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { STATUS_META, type ClientWorkflowProgress, type WorkflowStepStatus } from '@/lib/utils/workflow-types'
import { dayLabelsShort } from '@/lib/utils/posting-cadence'

interface Props {
  rows: ClientWorkflowProgress[]
}

const STATUS_ICONS = {
  reagendar: RefreshCcw,
  agendar:   Calendar,
  ideas:     Lightbulb,
  listo:     CheckCircle2,
} as const

export function PlanningBoard({ rows }: Props) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const groups = useMemo(() => {
    const buckets: Record<WorkflowStepStatus, ClientWorkflowProgress[]> = {
      reagendar: [], agendar: [], ideas: [], listo: [],
    }
    const q = search.trim().toLowerCase()
    for (const r of rows) {
      if (q && !r.clientName.toLowerCase().includes(q)) continue
      buckets[r.status].push(r)
    }
    return buckets
  }, [rows, search])

  const stats = useMemo(() => {
    const counts: Record<WorkflowStepStatus, number> = { reagendar: 0, agendar: 0, ideas: 0, listo: 0 }
    for (const r of rows) counts[r.status]++
    return counts
  }, [rows])

  const pending = stats.reagendar + stats.agendar + stats.ideas
  const allDone = pending === 0

  return (
    <div className="space-y-5">
      {/* Hero status */}
      <Card
        className={cn(
          'overflow-hidden border-2 transition-colors animate-in fade-in slide-in-from-top-2 duration-500',
          allDone
            ? 'border-green-500/40 bg-green-500/5'
            : stats.reagendar > 0
              ? 'border-red-500/40 bg-red-500/5'
              : 'border-orange-500/30 bg-orange-500/5',
        )}
      >
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Planning de la semana
              </p>
              <h2 className="mt-1 text-2xl font-bold md:text-3xl">
                {allDone
                  ? '🎯 Todos los clientes listos para grabar'
                  : `${pending} cliente${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'}`}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {allDone
                  ? 'Cada cliente tiene su próxima sesión agendada y suficientes ideas listas.'
                  : 'Termina la planificación antes de pasar a producir.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill status="reagendar" count={stats.reagendar} />
              <StatusPill status="agendar"   count={stats.agendar} />
              <StatusPill status="ideas"     count={stats.ideas} />
              <StatusPill status="listo"     count={stats.listo} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="h-9 pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? <ChevronDown className="mr-1 h-3.5 w-3.5" /> : <ChevronUp className="mr-1 h-3.5 w-3.5" />}
          {collapsed ? 'Expandir' : 'Contraer'} listos
        </Button>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {(['reagendar', 'agendar', 'ideas'] as const).map((s) =>
          groups[s].length > 0 ? <ClientGroup key={s} status={s} rows={groups[s]} /> : null,
        )}
        {groups.listo.length > 0 && (
          <ClientGroup status="listo" rows={groups.listo} collapsedDefault={collapsed} />
        )}
      </div>
    </div>
  )
}

function StatusPill({ status, count }: { status: WorkflowStepStatus; count: number }) {
  const meta = STATUS_META[status]
  const Icon = STATUS_ICONS[status]
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
        meta.tone,
        count === 0 && 'opacity-50',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="tabular-nums">{count}</span>
      <span className="hidden sm:inline">{meta.label}</span>
    </div>
  )
}

function ClientGroup({
  status,
  rows,
  collapsedDefault,
}: {
  status: WorkflowStepStatus
  rows: ClientWorkflowProgress[]
  collapsedDefault?: boolean
}) {
  const [open, setOpen] = useState(!collapsedDefault)
  const meta = STATUS_META[status]
  const Icon = STATUS_ICONS[status]

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      <CardHeader className="pb-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
        >
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <span className={cn('grid h-7 w-7 place-items-center rounded-lg', meta.tone)}>
              <Icon className="h-4 w-4" />
            </span>
            <span>{meta.label}</span>
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {rows.length}
            </span>
          </CardTitle>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-0 p-0">
          <ul className="divide-y">
            {rows.map((r, i) => (
              <ClientRow key={r.clientId} row={r} index={i} />
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}

function ClientRow({ row, index }: { row: ClientWorkflowProgress; index: number }) {
  const meta = STATUS_META[row.status]
  return (
    <li
      className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 animate-in fade-in slide-in-from-left-1 duration-300"
      style={{ animationDelay: `${Math.min(index * 25, 600)}ms`, animationFillMode: 'backwards' }}
    >
      <div className="min-w-0 flex-1">
        <Link href={`/clients/${row.clientId}`} className="block truncate font-medium hover:text-primary">
          {row.clientName}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {row.postingDays.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {row.postingDays.map((d) => dayLabelsShort[d]).join(', ')}
            </span>
          ) : (
            <span>Sin días configurados</span>
          )}
          <span>
            Ideas <strong className={cn('tabular-nums', row.ideaCount >= row.ideasTarget ? 'text-green-500' : 'text-foreground')}>
              {row.ideaCount}/{row.ideasTarget}
            </strong>
          </span>
          {row.nextSessionAt && <span>Próxima: <strong className="text-foreground">{formatDate(row.nextSessionAt)}</strong></span>}
          {!row.nextSessionAt && row.lastSessionAt && <span>Última: <strong className="text-foreground">{formatDate(row.lastSessionAt)}</strong></span>}
        </div>
      </div>
      <div className={cn('shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap', meta.tone)}>
        {meta.label}
      </div>
      <ActionButton row={row} />
    </li>
  )
}

function ActionButton({ row }: { row: ClientWorkflowProgress }) {
  if (row.status === 'listo') {
    return (
      <Link href={`/clients/${row.clientId}`} className="text-xs text-muted-foreground hover:text-primary" aria-label="Ver cliente">
        <ArrowRight className="h-4 w-4" />
      </Link>
    )
  }
  if (row.status === 'agendar' || row.status === 'reagendar') {
    return (
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link href={`/recording-calendar?client=${row.clientId}`}>
          <Calendar className="mr-1.5 h-3.5 w-3.5" /> Agendar
        </Link>
      </Button>
    )
  }
  // ideas
  return (
    <Button asChild size="sm" variant="outline" className="shrink-0">
      <Link href={`/ideacion?client=${row.clientId}`}>
        <Lightbulb className="mr-1.5 h-3.5 w-3.5" /> Añadir ideas
      </Link>
    </Button>
  )
}
