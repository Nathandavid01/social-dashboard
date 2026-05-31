'use client'

import { useState, useEffect, useMemo } from 'react'
import type { VideoReview, Client } from '@/lib/supabase/types'
import { useRealtimeVideoReviews } from '@/lib/hooks/use-realtime-video-reviews'
import { VideoReviewCard } from './video-review-card'
import { ReviewSheet } from './review-sheet'
import { SubmitVideoForm } from './submit-video-form'
import { PostingCard } from '@/components/posting/posting-card'
import type { PostingQueueItem } from '@/lib/actions/posting'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Film, Plus, Eye, Send, Inbox, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ColumnKey = 'in_review' | 'revision_needed' | 'sent_metricool'

interface Column {
  key: ColumnKey
  label: string
  icon: React.ElementType
  iconClass: string
  borderClass: string
  headerClass: string
}

const COLUMNS: Column[] = [
  {
    key: 'in_review',
    label: 'En Revisión',
    icon: Eye,
    iconClass: 'text-yellow-500',
    borderClass: 'border-yellow-200',
    headerClass: 'bg-yellow-50 text-yellow-700',
  },
  {
    key: 'revision_needed',
    label: 'Necesita Cambios',
    icon: AlertCircle,
    iconClass: 'text-red-500',
    borderClass: 'border-red-200',
    headerClass: 'bg-red-50 text-red-700',
  },
  {
    key: 'sent_metricool',
    label: 'Enviados a Metricool',
    icon: Send,
    iconClass: 'text-indigo-500',
    borderClass: 'border-indigo-200',
    headerClass: 'bg-indigo-50 text-indigo-700',
  },
]

interface VideoReviewBoardProps {
  initialReviews: VideoReview[]
  clients: Pick<Client, 'id' | 'name'>[]
  sentReviewIds?: string[]
}

export function VideoReviewBoard({ initialReviews, clients, sentReviewIds: initialSent = [] }: VideoReviewBoardProps) {
  const reviews = useRealtimeVideoReviews(initialReviews)
  const [selectedReview, setSelectedReview] = useState<VideoReview | null>(null)
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [pendientesOpen, setPendientesOpen] = useState(true)
  const [aprobadosOpen, setAprobadosOpen] = useState(true)
  const [sentReviewIds, setSentReviewIds] = useState<string[]>(initialSent)

  const sentSet = useMemo(() => new Set(sentReviewIds), [sentReviewIds])

  useEffect(() => {
    if (selectedReview) {
      const updated = reviews.find((r) => r.id === selectedReview.id)
      if (updated) setSelectedReview(updated)
    }
  }, [reviews, selectedReview?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredReviews = useMemo(() =>
    clientFilter === 'all' ? reviews : reviews.filter((r) => r.client_id === clientFilter),
    [reviews, clientFilter]
  )

  // Bubble groupings
  const pendientes = filteredReviews.filter((r) => r.status === 'submitted')
  const aprobadosNotSent = filteredReviews.filter((r) => r.status === 'approved' && !sentSet.has(r.id))

  // Column groupings — any in-progress status counts as "in review"
  const inRevision = filteredReviews.filter((r) =>
    r.status === 'head_editor_review' || r.status === 'final_check_review' || r.status === 'pending_final_check'
  )
  const needsChanges = filteredReviews.filter((r) => r.status === 'revision_needed')
  const sentToMetricool = filteredReviews.filter((r) => r.status === 'approved' && sentSet.has(r.id))

  const byColumn = (key: ColumnKey): VideoReview[] => {
    if (key === 'in_review') return inRevision
    if (key === 'revision_needed') return needsChanges
    if (key === 'sent_metricool') return sentToMetricool
    return []
  }

  const totalActive = inRevision.length + needsChanges.length

  function toPostingItem(review: VideoReview): PostingQueueItem {
    const c = (review.client as unknown) as PostingQueueItem['client']
    return { review, client: c, draft: null }
  }

  function handleSentToMetricool(reviewId: string) {
    setSentReviewIds((prev) => Array.from(new Set([...prev, reviewId])))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Video QC
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalActive} activo{totalActive !== 1 ? 's' : ''} · {aprobadosNotSent.length} aprobado{aprobadosNotSent.length !== 1 ? 's' : ''} listo{aprobadosNotSent.length !== 1 ? 's' : ''} para publicar · {sentToMetricool.length} enviado{sentToMetricool.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pendientes bubble */}
          {pendientes.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendientesOpen((v) => !v)}
              className="h-8 gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>{pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}</span>
              {pendientesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
          {/* Aprobados bubble */}
          {aprobadosNotSent.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAprobadosOpen((v) => !v)}
              className="h-8 gap-2 border-green-400 text-green-700 hover:bg-green-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{aprobadosNotSent.length} aprobado{aprobadosNotSent.length !== 1 ? 's' : ''}</span>
              {aprobadosOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
          {clients.length > 1 && (
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setShowSubmitForm(true)} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Enviar Video
          </Button>
        </div>
      </div>

      {/* Pendientes expandable strip */}
      {pendientesOpen && pendientes.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-white/90 px-1">VIDEOS RECIÉN ENVIADOS — Head Editor: empieza la revisión</p>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pendientes.map((review) => (
              <VideoReviewCard
                key={review.id}
                review={review}
                onClick={() => setSelectedReview(review)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Aprobados expandable strip with inline posting actions */}
      {aprobadosOpen && aprobadosNotSent.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/50 p-3 space-y-3">
          <p className="text-xs font-semibold text-white/90 px-1">
            APROBADOS — Genera caption y envía a Metricool
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {aprobadosNotSent.map((review) => (
              <PostingCard
                key={review.id}
                item={toPostingItem(review)}
                onSent={() => handleSentToMetricool(review.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {COLUMNS.map((col) => {
          const colReviews = byColumn(col.key)
          const Icon = col.icon
          return (
            <div key={col.key} className={cn('rounded-xl border', col.borderClass)}>
              <div className={cn('flex items-center gap-2 px-3 py-2.5 rounded-t-xl', col.headerClass)}>
                <Icon className={cn('h-4 w-4 shrink-0', col.iconClass)} />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="ml-auto text-xs font-bold opacity-70">{colReviews.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[120px]">
                {colReviews.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Sin videos
                  </div>
                ) : (
                  colReviews.map((review) => (
                    <VideoReviewCard
                      key={review.id}
                      review={review}
                      onClick={() => setSelectedReview(review)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {filteredReviews.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Film className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Sin videos enviados aún</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Los editores pueden enviar sus videos aquí para revisión de calidad
          </p>
          <Button onClick={() => setShowSubmitForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Enviar Primer Video
          </Button>
        </div>
      )}

      <ReviewSheet
        review={selectedReview}
        open={!!selectedReview}
        onClose={() => setSelectedReview(null)}
      />

      <SubmitVideoForm
        open={showSubmitForm}
        onClose={() => setShowSubmitForm(false)}
        clients={clients}
      />
    </div>
  )
}
