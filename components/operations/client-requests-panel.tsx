'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Inbox, MoreHorizontal, CheckCircle2, Eye, X, ArrowRight, Clock, ExternalLink, Zap } from 'lucide-react'
import type { ClientRequest } from '@/lib/supabase/types'
import { convertRequestToTask, updateRequestStatus } from '@/lib/actions/client-requests'
import { useToast } from '@/lib/hooks/use-toast'

const urgencyConfig = {
  urgent: { label: '🔴 Urgente', badge: 'bg-red-500/10 text-red-500 border-red-500/20' },
  high: { label: '🟠 Alta', badge: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  normal: { label: '🟡 Normal', badge: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  low: { label: '🟢 Baja', badge: 'bg-green-500/10 text-green-500 border-green-500/20' },
}

const statusConfig = {
  new: { label: 'Nueva', badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  in_review: { label: 'En revisión', badge: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  converted: { label: 'Convertida', badge: 'bg-green-500/10 text-green-500 border-green-500/20' },
  rejected: { label: 'Rechazada', badge: 'bg-muted text-muted-foreground border-border' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

interface Props {
  initialRequests: ClientRequest[]
  showHistory?: boolean
}

export function ClientRequestsPanel({ initialRequests, showHistory = false }: Props) {
  const [requests, setRequests] = useState(initialRequests)
  const [selected, setSelected] = useState<ClientRequest | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const [showAll, setShowAll] = useState(showHistory)
  const [showClosed, setShowClosed] = useState(showHistory)
  // notes is null until user edits; actual display uses selected.notes as fallback

  const open = requests.filter((r) => r.status === 'new' || r.status === 'in_review')
  const closed = requests.filter((r) => r.status === 'converted' || r.status === 'rejected')
  const visible = showAll ? open : open.slice(0, 5)
  const closedCount = closed.length

  function handleStatusChange(id: string, status: ClientRequest['status']) {
    startTransition(async () => {
      const result = await updateRequestStatus(id, status)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r))
        if (selected?.id === id) { setSelected((s) => s ? { ...s, status } : null); setNotes(null) }
        toast({ title: 'Estado actualizado' })
      }
    })
  }

  function handleConvertToTask(request: ClientRequest) {
    startTransition(async () => {
      const result = await convertRequestToTask(request.id)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        setRequests((prev) => prev.map((r) => r.id === request.id ? { ...r, status: 'converted', task_id: result.taskId ?? null } : r))
        setSelected(null)
        toast({ title: 'Convertida a tarea', description: 'La solicitud aparece ahora en el tablero de Operaciones.' })
      }
    })
  }

  const effectiveNotes = notes !== null ? notes : (selected?.notes ?? '')

  // Real-time new request subscription
  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel('client-requests-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'client_requests' }, (payload) => {
        setRequests((prev) => [payload.new as ClientRequest, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'client_requests' }, (payload) => {
        setRequests((prev) => prev.map((r) => r.id === payload.new.id ? { ...r, ...payload.new } as ClientRequest : r))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (open.length === 0 && closedCount === 0) return null

  return (
    <>
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm text-blue-600 dark:text-blue-400">
                Solicitudes de Clientes
                {open.length > 0 && (
                  <span className="ml-2 text-xs font-normal bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                    {open.length} nueva{open.length !== 1 ? 's' : ''}
                  </span>
                )}
              </CardTitle>
            </div>
            <a
              href="/portal"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Abrir portal <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No hay solicitudes pendientes.</p>
          ) : (
            <>
              {visible.map((req) => {
                const urgency = urgencyConfig[req.urgency as keyof typeof urgencyConfig] ?? urgencyConfig.normal
                const status = statusConfig[req.status as keyof typeof statusConfig] ?? statusConfig.new
                return (
                  <div
                    key={req.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5 hover:bg-background transition-colors cursor-pointer group"
                    onClick={() => setSelected(req)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold truncate">{req.company_name}</span>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${urgency.badge}`}>
                          {urgency.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${status.badge}`}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{req.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{req.contact_name}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />{timeAgo(req.created_at)}
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelected(req) }}>
                          <Eye className="mr-2 h-4 w-4" /> Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleConvertToTask(req) }} disabled={isPending}>
                          <Zap className="mr-2 h-4 w-4" /> Convertir a tarea
                        </DropdownMenuItem>
                        {req.status !== 'in_review' && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(req.id, 'in_review') }}>
                            <ArrowRight className="mr-2 h-4 w-4" /> Marcar en revisión
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(req.id, 'rejected') }}
                        >
                          <X className="mr-2 h-4 w-4" /> Rechazar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}

              {open.length > 5 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full text-xs text-muted-foreground hover:text-primary text-center py-1 transition-colors"
                >
                  {showAll ? 'Ver menos' : `+${open.length - 5} más`}
                </button>
              )}
            </>
          )}

          {closedCount > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowClosed((v) => !v)}
                className="w-full text-[10px] text-muted-foreground hover:text-primary text-center py-1 transition-colors flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                {showClosed ? 'Ocultar' : `Ver ${closedCount}`} procesada{closedCount !== 1 ? 's' : ''}
              </button>
              {showClosed && (
                <div className="space-y-2 mt-2 opacity-60">
                  {closed.map((req) => {
                    const urgency = urgencyConfig[req.urgency as keyof typeof urgencyConfig] ?? urgencyConfig.normal
                    const status = statusConfig[req.status as keyof typeof statusConfig] ?? statusConfig.new
                    return (
                      <div
                        key={req.id}
                        className="flex items-start gap-3 rounded-lg border border-border bg-background/60 px-3 py-2 cursor-pointer hover:opacity-80"
                        onClick={() => setSelected(req)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-sm font-medium truncate">{req.company_name}</span>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${status.badge}`}>{status.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{req.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) { setSelected(null); setNotes(null) } }}>
        {selected && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-blue-500" />
                Solicitud de {selected.company_name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Badges */}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${(urgencyConfig[selected.urgency as keyof typeof urgencyConfig] ?? urgencyConfig.normal).badge}`}>
                  {(urgencyConfig[selected.urgency as keyof typeof urgencyConfig] ?? urgencyConfig.normal).label}
                </Badge>
                <Badge variant="outline" className={`text-xs ${(statusConfig[selected.status as keyof typeof statusConfig] ?? statusConfig.new).badge}`}>
                  {(statusConfig[selected.status as keyof typeof statusConfig] ?? statusConfig.new).label}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">{timeAgo(selected.created_at)}</span>
              </div>

              {/* Contact info */}
              <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1.5 text-sm">
                <p><span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Contacto</span></p>
                <p className="font-medium">{selected.contact_name}</p>
                {selected.contact_email && <p className="text-muted-foreground">{selected.contact_email}</p>}
                {selected.contact_phone && <p className="text-muted-foreground">{selected.contact_phone}</p>}
                <p className="text-xs text-primary capitalize">{selected.request_type}</p>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Solicitud</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/20 rounded-lg px-3 py-2.5">
                  {selected.description}
                </p>
              </div>

              {/* Internal notes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notas internas</p>
                  {notes !== null && effectiveNotes !== (selected.notes ?? '') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await updateRequestStatus(selected.id, selected.status, effectiveNotes)
                          if (result.error) {
                            toast({ title: 'Error', description: result.error, variant: 'destructive' })
                          } else {
                            setRequests((prev) => prev.map((r) => r.id === selected.id ? { ...r, notes: effectiveNotes } : r))
                            setNotes(null)
                            toast({ title: 'Notas guardadas' })
                          }
                        })
                      }}
                    >
                      Guardar
                    </Button>
                  )}
                </div>
                <Textarea
                  value={effectiveNotes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Agrega notas del equipo..."
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => handleConvertToTask(selected)}
                  disabled={isPending || selected.status === 'converted'}
                  className="flex-1"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  {selected.status === 'converted' ? 'Ya convertida' : 'Convertir a tarea'}
                </Button>
                {selected.status === 'new' && (
                  <Button
                    variant="outline"
                    onClick={() => handleStatusChange(selected.id, 'in_review')}
                    disabled={isPending}
                  >
                    En revisión
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { handleStatusChange(selected.id, 'rejected'); setSelected(null) }}
                  disabled={isPending}
                >
                  Rechazar
                </Button>
              </div>

              {selected.task_id && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Tarea creada — visible en Operations Board
                </p>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
