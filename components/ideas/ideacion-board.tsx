'use client'

import { useMemo, useState } from 'react'
import type { ContentIdea, Client, Profile, ContentIdeaStatus } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Lightbulb, Plus, Filter } from 'lucide-react'
import { IdeaCard } from './idea-card'
import { GenerateIdeasModal } from './generate-ideas-modal'
import { AssignToProductionModal } from './assign-to-production-modal'
import { EmptyState } from '@/components/shared/empty-state'

interface Props {
  initialIdeas: ContentIdea[]
  clients: Client[]
  profiles: Pick<Profile, 'id' | 'full_name'>[]
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

export function IdeacionBoard({ initialIdeas, clients, profiles }: Props) {
  const [ideas, setIdeas] = useState<ContentIdea[]>(initialIdeas)
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | ContentIdeaStatus>('open')
  const [showGenerator, setShowGenerator] = useState(false)
  const [assigningIdea, setAssigningIdea] = useState<ContentIdea | null>(null)

  const filtered = useMemo(() => {
    return ideas.filter((idea) => {
      if (clientFilter !== 'all' && idea.client_id !== clientFilter) return false
      if (statusFilter === 'all') return true
      if (statusFilter === 'open') return ['idea', 'asignada', 'producida'].includes(idea.status)
      return idea.status === statusFilter
    })
  }, [ideas, clientFilter, statusFilter])

  function handleIdeasGenerated(newIdeas: ContentIdea[]) {
    setIdeas((prev) => [...newIdeas, ...prev])
  }

  function handleIdeaUpdate(updated: ContentIdea) {
    setIdeas((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  function handleIdeaDelete(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id))
  }

  const stats = {
    total: ideas.length,
    idea: ideas.filter((i) => i.status === 'idea').length,
    asignada: ideas.filter((i) => i.status === 'asignada').length,
    producida: ideas.filter((i) => i.status === 'producida').length,
    publicada: ideas.filter((i) => i.status === 'publicada').length,
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="font-medium">{stats.total} ideas</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{stats.idea} pendientes</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{stats.asignada + stats.producida} en flujo</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-green-600">{stats.publicada} publicadas</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'open' | ContentIdeaStatus)}>
            <SelectTrigger className="h-8 w-[140px] text-xs gap-1">
              <Filter className="h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowGenerator(true)} className="gap-2 h-8">
            <Plus className="h-4 w-4" />
            Generar ideas
          </Button>
        </div>
      </div>

      {/* Ideas grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={ideas.length === 0 ? 'Aún no hay ideas' : 'Ningún resultado'}
          description={
            ideas.length === 0
              ? 'Genera ideas con IA basadas en el perfil de cada cliente y su historia de publicaciones.'
              : 'Cambia los filtros o genera nuevas ideas.'
          }
          action={
            <Button onClick={() => setShowGenerator(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Generar ideas
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              clients={clients}
              onUpdate={handleIdeaUpdate}
              onDelete={handleIdeaDelete}
              onAssign={() => setAssigningIdea(idea)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <GenerateIdeasModal
        open={showGenerator}
        onClose={() => setShowGenerator(false)}
        clients={clients}
        onIdeasGenerated={handleIdeasGenerated}
      />

      {assigningIdea && (
        <AssignToProductionModal
          idea={assigningIdea}
          profiles={profiles}
          onClose={() => setAssigningIdea(null)}
          onAssigned={(updated) => {
            handleIdeaUpdate(updated)
            setAssigningIdea(null)
          }}
        />
      )}
    </div>
  )
}
