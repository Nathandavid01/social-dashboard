'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Check, X, ArrowRight, AlertTriangle, Search } from 'lucide-react'
import { adoptInferredCadence } from '@/lib/actions/cadence'
import { useToast } from '@/lib/hooks/use-toast'
import { dayLabelsShort } from '@/lib/utils/posting-cadence'
import { cn } from '@/lib/utils'
import type { CadenceRow } from '@/lib/actions/cadence'

interface Props {
  rows: CadenceRow[]
}

const DAYS = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun
const TOTAL_DAY_COUNTS = (counts: Record<number, number>) =>
  Object.values(counts).reduce((s, c) => s + c, 0)

export function CadenceTable({ rows: initial }: Props) {
  const [rows, setRows] = useState(initial)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'volume' | 'mismatch'>('volume')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let arr = rows
    if (q) arr = arr.filter((r) => r.clientName.toLowerCase().includes(q))
    arr = [...arr].sort((a, b) => {
      if (sortBy === 'name') return a.clientName.localeCompare(b.clientName)
      if (sortBy === 'volume') return (b.inferred?.postsPerWeekAvg ?? 0) - (a.inferred?.postsPerWeekAvg ?? 0)
      const aMismatch = a.newSuggestedDays.length + a.configuredButUnused.length
      const bMismatch = b.newSuggestedDays.length + b.configuredButUnused.length
      return bMismatch - aMismatch
    })
    return arr
  }, [rows, search, sortBy])

  const stats = useMemo(() => {
    let withInferred = 0
    let withoutBlog = 0
    let totalPerWeek = 0
    let mismatched = 0
    for (const r of rows) {
      if (!r.blogId) withoutBlog++
      if (r.inferred && r.inferred.totalCounted > 0) {
        withInferred++
        totalPerWeek += r.inferred.postsPerWeekAvg
        if (r.newSuggestedDays.length > 0 || r.configuredButUnused.length > 0) mismatched++
      }
    }
    return { withInferred, withoutBlog, totalPerWeek, mismatched, total: rows.length }
  }, [rows])

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <SummaryCard label="Clientes activos"    value={stats.total} />
        <SummaryCard label="Con historial Metricool" value={stats.withInferred} />
        <SummaryCard label="Posts/semana totales"  value={stats.totalPerWeek.toFixed(1)} hint="Promedio últimos 60 días" />
        <SummaryCard label="Configuración no coincide" value={stats.mismatched} tone={stats.mismatched > 0 ? 'warning' : 'default'} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex gap-1">
          {(['volume', 'mismatch', 'name'] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={sortBy === k ? 'default' : 'outline'}
              onClick={() => setSortBy(k)}
              className="text-xs"
            >
              {k === 'volume' ? 'Volumen' : k === 'mismatch' ? 'Sin sincronizar' : 'Nombre'}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {/* Desktop: table */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[1fr_auto_auto_1fr_auto] items-center gap-3 border-b bg-muted/30 px-4 py-2.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Cliente</span>
              <span>Posts/sem</span>
              <span>Volumen 60d</span>
              <span>Distribución por día</span>
              <span className="text-right">Acción</span>
            </div>
            <ul className="divide-y">
              {filtered.map((r, i) => (
                <CadenceRowDesktop key={r.clientId} row={r} index={i} onAdopted={(next) => {
                  setRows((prev) => prev.map((p) => (p.clientId === r.clientId ? { ...p, configuredDays: next, newSuggestedDays: [], configuredButUnused: [] } : p)))
                }} />
              ))}
            </ul>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden">
            <ul className="divide-y">
              {filtered.map((r, i) => (
                <CadenceRowMobile key={r.clientId} row={r} index={i} onAdopted={(next) => {
                  setRows((prev) => prev.map((p) => (p.clientId === r.clientId ? { ...p, configuredDays: next, newSuggestedDays: [], configuredButUnused: [] } : p)))
                }} />
              ))}
            </ul>
          </div>

          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin resultados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, hint, tone = 'default' }: { label: string; value: number | string; hint?: string; tone?: 'default' | 'warning' }) {
  return (
    <Card className={cn(tone === 'warning' && Number(value) > 0 && 'border-yellow-500/30 bg-yellow-500/5')}>
      <CardContent className="p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function DayPill({ day, count, isConfigured, isActive, hidden }: { day: number; count: number; isConfigured: boolean; isActive: boolean; hidden?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded px-1.5 py-1 text-[9px] font-medium',
        hidden && 'opacity-30',
        isConfigured && isActive   && 'bg-green-500/20 text-green-500 ring-1 ring-green-500/40',
        isConfigured && !isActive  && 'bg-yellow-500/20 text-yellow-500 ring-1 ring-yellow-500/40',
        !isConfigured && isActive  && 'bg-blue-500/20 text-blue-500 ring-1 ring-blue-500/40',
        !isConfigured && !isActive && 'bg-muted text-muted-foreground',
      )}
      title={`${dayLabelsShort[day]} · ${count} post${count === 1 ? '' : 's'} · ${isConfigured ? 'configurado' : 'no configurado'}${isActive ? ' · activo' : ''}`}
    >
      <span>{dayLabelsShort[day]}</span>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </div>
  )
}

function DistributionBars({ row }: { row: CadenceRow }) {
  const counts = row.inferred?.countByDayOfWeek ?? { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  const total = row.inferred ? TOTAL_DAY_COUNTS(counts) : 0
  const activeSet = new Set(row.inferred?.activeDays ?? [])
  const configuredSet = new Set(row.configuredDays)
  return (
    <div className="flex gap-1">
      {DAYS.map((d) => (
        <DayPill
          key={d}
          day={d}
          count={counts[d] ?? 0}
          isConfigured={configuredSet.has(d)}
          isActive={activeSet.has(d)}
          hidden={total === 0 && !configuredSet.has(d)}
        />
      ))}
    </div>
  )
}

function AdoptButton({ row, onDone }: { row: CadenceRow; onDone: (next: number[]) => void }) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  if (!row.inferred || row.inferred.totalCounted === 0) return null
  if (row.newSuggestedDays.length === 0 && row.configuredButUnused.length === 0 && row.configuredDays.length > 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-green-500"><Check className="h-3 w-3" />Sincronizado</span>
  }

  const targetDays = row.inferred.activeDays.length > 0 ? row.inferred.activeDays : row.configuredDays

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const res = await adoptInferredCadence(row.clientId, targetDays)
          if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
          else {
            toast({ title: 'Cadencia actualizada', description: `${targetDays.length} días aplicados a ${row.clientName}` })
            onDone(targetDays)
          }
        })
      }}
    >
      {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ArrowRight className="mr-1 h-3 w-3" />}
      Adoptar ({targetDays.length}d)
    </Button>
  )
}

function CadenceRowDesktop({ row, index, onAdopted }: { row: CadenceRow; index: number; onAdopted: (next: number[]) => void }) {
  return (
    <li
      className="grid grid-cols-[1fr_auto_auto_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-muted/40 animate-in fade-in slide-in-from-left-1 duration-300"
      style={{ animationDelay: `${Math.min(index * 25, 600)}ms`, animationFillMode: 'backwards' }}
    >
      <div className="min-w-0">
        <Link href={`/clients/${row.clientId}`} className="truncate font-medium hover:text-primary">
          {row.clientName}
        </Link>
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {row.blogId ? `Metricool blog ${row.blogId}` : 'Sin Metricool'} ·{' '}
          {row.error ? <span className="text-red-500">{row.error}</span> :
            row.inferred?.totalCounted ?
              `${row.inferred.totalCounted} posts en ${row.inferred.windowDays}d` :
              row.blogId ? 'Sin actividad reciente' : 'Configura blog en Metricool'}
        </div>
      </div>
      <div className="text-right">
        {row.inferred ? (
          <p className="text-lg font-bold tabular-nums">{row.inferred.postsPerWeekAvg.toFixed(1)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>
      <div className="text-right text-xs text-muted-foreground">
        {row.inferred?.totalCounted ?? 0}
      </div>
      <DistributionBars row={row} />
      <div className="text-right">
        <AdoptButton row={row} onDone={onAdopted} />
      </div>
    </li>
  )
}

function CadenceRowMobile({ row, index, onAdopted }: { row: CadenceRow; index: number; onAdopted: (next: number[]) => void }) {
  return (
    <li
      className="space-y-2 px-4 py-3 animate-in fade-in slide-in-from-left-1 duration-300"
      style={{ animationDelay: `${Math.min(index * 25, 600)}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/clients/${row.clientId}`} className="block truncate font-medium hover:text-primary">
            {row.clientName}
          </Link>
          <p className="text-[10px] text-muted-foreground">
            {row.inferred?.totalCounted ?
              `${row.inferred.postsPerWeekAvg.toFixed(1)} /sem · ${row.inferred.totalCounted} posts 60d` :
              row.blogId ? 'Sin actividad reciente' : 'Sin Metricool'}
          </p>
        </div>
        <AdoptButton row={row} onDone={onAdopted} />
      </div>
      <DistributionBars row={row} />
      {row.error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertTriangle className="h-3 w-3" /> {row.error}
        </p>
      )}
    </li>
  )
}
