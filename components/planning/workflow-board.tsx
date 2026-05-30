'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Calendar, Search,
  Send, Loader2, X, Plus, Filter, Film,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { assignIdeaToProductionTask } from '@/lib/actions/content-ideas'
import { IdeaRow, type IdeaDates } from '@/components/ideas/client-ideas-rows'
import { ClientLogo } from '@/components/clients/client-logo'
import { useHasPermission } from '@/components/auth/role-gate'
import { GenerateIdeasModal } from '@/components/ideas/generate-ideas-modal'
import { AssignToProductionModal } from '@/components/ideas/assign-to-production-modal'
import { InlineDayPicker } from './inline-day-picker'
import { WorkflowStats } from './workflow-stats'
import { STATUS_META, type ClientWorkflowProgress } from '@/lib/utils/workflow-types'
import { recordingWindowSize, DEFAULT_RECORDING_INTERVAL_WEEKS } from '@/lib/utils/recording-window'
import type { ContentIdea, IdeaWithPipeline, Client, Profile, ContentIdeaStatus } from '@/lib/supabase/types'

interface Props {
  clients: ClientWorkflowProgress[]
  initialIdeas: IdeaWithPipeline[]
  profiles: Pick<Profile, 'id' | 'full_name'>[]
  clientList: Client[]
  /** Per-client recording interval (weeks). Missing → default. */
  intervalByClient?: Record<string, number>
}

const STATUS_OPTIONS: { value: 'all' | 'open' | ContentIdeaStatus; label: string }[] = [
  { value: 'open', label: 'Abiertas' },
  { value: 'idea', label: 'Idea' },
  { value: 'asignada', label: 'Asignadas' },
  { value: 'producida', label: 'En producción' },
  { value: 'publicada', label: 'Publicadas' },
  { value: 'descartada', label: 'Descartadas' },
  { value: 'all', label: 'Todas' },
]

function defaultPublishDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function WorkflowBoard({ clients, initialIdeas, profiles, clientList, intervalByClient = {} }: Props) {
  const { toast } = useToast()
  const canAssign = useHasPermission('planning.assign')
  const [ideas, setIdeas] = useState<IdeaWithPipeline[]>(initialIdeas)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | ContentIdeaStatus>('open')
  const [showGenerator, setShowGenerator] = useState(false)
  const [assigningIdea, setAssigningIdea] = useState<IdeaWithPipeline | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAssignee, setBulkAssignee] = useState<string>('unassigned')
  const [isBulkPending, startBulk] = useTransition()

  // Ideas grouped by client, filtered by status.
  const ideasByClient = useMemo(() => {
    const map = new Map<string, IdeaWithPipeline[]>()
    for (const idea of ideas) {
      if (statusFilter === 'open' && !['idea', 'asignada', 'producida'].includes(idea.status)) continue
      if (statusFilter !== 'all' && statusFilter !== 'open' && idea.status !== statusFilter) continue
      const arr = map.get(idea.client_id) ?? []
      arr.push(idea)
      map.set(idea.client_id, arr)
    }
    return map
  }, [ideas, statusFilter])

  const visibleClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((c) => !q || c.clientName.toLowerCase().includes(q))
  }, [clients, search])

  const logoByClient = useMemo(() => {
    const map: Record<string, string | null> = {}
    for (const c of clientList) map[c.id] = c.logo_url ?? null
    return map
  }, [clientList])

  function handleIdeasGenerated(newIdeas: ContentIdea[]) {
    const enriched: IdeaWithPipeline[] = newIdeas.map((i) => ({ ...i, recordingScheduled: false, videos: [] }))
    setIdeas((prev) => [...enriched, ...prev])
  }

  function handleIdeaUpdate(updated: ContentIdea & Partial<Pick<IdeaWithPipeline, 'assignee'>>) {
    setIdeas((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)))
  }

  function handleDatesSaved(id: string, dates: IdeaDates) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...dates } : i)))
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(ids: string[], select: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) select ? next.add(id) : next.delete(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setBulkAssignee('unassigned')
  }

  function runBulkAssign() {
    const selected = ideas.filter((i) => selectedIds.has(i.id) && i.status === 'idea')
    if (selected.length === 0) return
    const assignedToId = bulkAssignee === 'unassigned' ? null : bulkAssignee
    const assigneeProfile = assignedToId ? profiles.find((p) => p.id === assignedToId) ?? null : null
    startBulk(async () => {
      const results = await Promise.all(
        selected.map((idea) => {
          const publishDate = idea.publish_date ? idea.publish_date.slice(0, 10) : defaultPublishDate()
          return assignIdeaToProductionTask({
            ideaId: idea.id,
            clientId: idea.client_id,
            contentType: idea.content_type,
            publishDate,
            assignedToId,
            weekStart: getMondayOfWeek(publishDate),
          }).then((res) => ({ idea, res }))
        }),
      )
      const ok = results.filter((r) => !r.res.error)
      const failed = results.filter((r) => r.res.error)
      for (const { idea, res } of ok) {
        handleIdeaUpdate({ ...idea, status: 'asignada', production_task_id: res.taskId ?? null, assignee: assigneeProfile })
      }
      if (failed.length === 0) {
        toast({ title: `${ok.length} idea${ok.length === 1 ? '' : 's'} asignada${ok.length === 1 ? '' : 's'} a producción` })
      } else {
        toast({ title: `${ok.length} asignadas, ${failed.length} con error`, description: failed[0].res.error, variant: 'destructive' })
      }
      clearSelection()
    })
  }

  const stats = {
    total: ideas.length,
    idea: ideas.filter((i) => i.status === 'idea').length,
    asignada: ideas.filter((i) => i.status === 'asignada').length,
    producida: ideas.filter((i) => i.status === 'producida').length,
    publicada: ideas.filter((i) => i.status === 'publicada').length,
  }
  const selectedCount = selectedIds.size

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WorkflowStats
          total={stats.total}
          pendientes={stats.idea}
          enFlujo={stats.asignada + stats.producida}
          publicadas={stats.publicada}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…" className="h-8 w-[180px] pl-8 text-xs" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'open' | ContentIdeaStatus)}>
            <SelectTrigger className="h-8 w-[140px] gap-1 text-xs">
              <Filter className="h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowGenerator(true)} className="h-8 gap-2">
            <Plus className="h-4 w-4" /> Generar ideas
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {canAssign && selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/60 px-4 py-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="text-sm font-medium tabular-nums">{selectedCount} seleccionada{selectedCount === 1 ? '' : 's'}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={bulkAssignee} onValueChange={setBulkAssignee} disabled={isBulkPending}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Asignar a…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Sin asignar</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 gap-1.5" onClick={runBulkAssign} disabled={isBulkPending}>
              {isBulkPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Asignar a producción
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={clearSelection} disabled={isBulkPending}>
              <X className="h-3.5 w-3.5" /> Limpiar
            </Button>
          </div>
        </div>
      )}

      {/* One card per client */}
      <div className="space-y-4">
        {visibleClients.map((c, i) => (
          <ClientCard
            key={c.clientId}
            client={c}
            logoUrl={logoByClient[c.clientId] ?? null}
            ideas={ideasByClient.get(c.clientId) ?? []}
            index={i}
            intervalWeeks={intervalByClient[c.clientId] ?? DEFAULT_RECORDING_INTERVAL_WEEKS}
            canAssign={canAssign}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleGroup={toggleGroup}
            onDatesSaved={handleDatesSaved}
            onAssign={(idea) => setAssigningIdea(idea)}
          />
        ))}
        {visibleClients.length === 0 && (
          <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            Ningún cliente coincide con la búsqueda.
          </p>
        )}
      </div>

      {/* Modals */}
      <GenerateIdeasModal open={showGenerator} onClose={() => setShowGenerator(false)} clients={clientList} onIdeasGenerated={handleIdeasGenerated} />
      {assigningIdea && (
        <AssignToProductionModal
          idea={assigningIdea}
          profiles={profiles}
          onClose={() => setAssigningIdea(null)}
          onAssigned={(updated) => { handleIdeaUpdate(updated); setAssigningIdea(null) }}
        />
      )}
    </div>
  )
}

function ClientCard({
  client, logoUrl, ideas, index, intervalWeeks, canAssign, selectedIds, onToggleSelect, onToggleGroup, onDatesSaved, onAssign,
}: {
  client: ClientWorkflowProgress
  logoUrl: string | null
  ideas: IdeaWithPipeline[]
  index: number
  intervalWeeks: number
  canAssign: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleGroup: (ids: string[], select: boolean) => void
  onDatesSaved: (id: string, dates: IdeaDates) => void
  onAssign: (idea: IdeaWithPipeline) => void
}) {
  const meta = STATUS_META[client.status]
  // Only surface the ideas needed for the next `intervalWeeks` of recording.
  const windowSize = recordingWindowSize(client.postingDays.length, intervalWeeks)
  const visibleIdeas = ideas.slice(0, windowSize)
  const hiddenCount = ideas.length - visibleIdeas.length
  const assignableIds = visibleIdeas.filter((i) => i.status === 'idea').map((i) => i.id)
  const allSelected = assignableIds.length > 0 && assignableIds.every((id) => selectedIds.has(id))

  return (
    <Card
      className="animate-in fade-in slide-in-from-bottom-1 duration-300"
      style={{ animationDelay: `${Math.min(index * 25, 500)}ms`, animationFillMode: 'backwards' }}
    >
      <CardHeader className="gap-2 border-b p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {canAssign && assignableIds.length > 0 && (
              <Checkbox
                checked={allSelected}
                onCheckedChange={() => onToggleGroup(assignableIds, !allSelected)}
                aria-label={`Seleccionar todos los videos de ${client.clientName}`}
                className="shrink-0"
              />
            )}
            <ClientLogo name={client.clientName} logoUrl={logoUrl} className="h-8 w-8 shrink-0 text-[10px]" />
            <Link href={`/clients/${client.clientId}`} className="truncate text-sm font-bold tracking-tight hover:text-primary">
              {client.clientName}
            </Link>
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap', meta.tone)}>
              {meta.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3 w-3 shrink-0" />
              <InlineDayPicker clientId={client.clientId} initial={client.postingDays} />
            </span>
            <span>
              Ideas <strong className={cn('tabular-nums', client.ideaCount >= client.ideasTarget ? 'text-green-500' : 'text-foreground')}>
                {client.ideaCount}/{client.ideasTarget}
              </strong>
            </span>
            {client.nextSessionAt && <span>Próxima: <strong className="text-foreground">{formatDate(client.nextSessionAt)}</strong></span>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {visibleIdeas.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            <Film className="mx-auto mb-1 h-5 w-5 text-muted-foreground/50" /> Sin videos para este filtro
          </div>
        ) : (
          <div className="divide-y">
            {visibleIdeas.map((idea) => (
              <IdeaRow
                key={idea.id}
                idea={idea}
                onAssign={onAssign}
                selectable={canAssign}
                selected={selectedIds.has(idea.id)}
                onToggleSelect={onToggleSelect}
                onDatesSaved={onDatesSaved}
                canAssign={canAssign}
              />
            ))}
          </div>
        )}
        {hiddenCount > 0 && (
          <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            {hiddenCount} video{hiddenCount === 1 ? '' : 's'} más adelante — fuera de la ventana de grabación ({intervalWeeks} sem)
          </p>
        )}
      </CardContent>
    </Card>
  )
}
