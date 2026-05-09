'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { getStoredConfig, type MetricoolConfig } from '@/lib/metricool/client'
import {
  getScheduledPosts,
  verifySchedule,
  getScheduleStats,
  type ScheduleVerification,
} from '@/lib/metricool/scheduler'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

type DateRange = '7d' | '30d' | '60d'
type StatusFilter = 'all' | 'on-time' | 'error' | 'pending' | 'draft'

function getDateRange(range: DateRange): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  switch (range) {
    case '7d': start.setDate(start.getDate() - 7); break
    case '30d': start.setDate(start.getDate() - 30); break
    case '60d': start.setDate(start.getDate() - 60); break
  }
  const fmt = (d: Date) => d.toISOString().split('.')[0]
  return { start: fmt(start), end: fmt(end) }
}

const statusConfig = {
  'on-time': { label: 'Publicado', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' },
  error: { label: 'Error', icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  pending: { label: 'Pendiente', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  draft: { label: 'Borrador', icon: FileText, color: 'text-neutral-400', bg: 'bg-neutral-500/10 border-neutral-500/20' },
  late: { label: 'Tarde', icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' },
}

const networkColors: Record<string, string> = {
  facebook: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  instagram: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  tiktok: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  twitter: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  linkedin: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  youtube: 'bg-red-500/10 text-red-500 border-red-500/20',
}

export function ScheduleChecker() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [verifications, setVerifications] = useState<ScheduleVerification[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    const config = getStoredConfig()
    if (!config) {
      setError('No hay credenciales de Metricool configuradas. Ve a la seccion de Metricool primero.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { start, end } = getDateRange(dateRange)

    try {
      const posts = await getScheduledPosts(config, start, end)
      const verified = verifySchedule(posts)
      // Sort by date descending
      verified.sort((a, b) => b.scheduledTime.localeCompare(a.scheduledTime))
      setVerifications(verified)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const stats = getScheduleStats(verifications)

  const filtered = verifications.filter((v) => {
    if (statusFilter === 'all') return true
    return v.overallStatus === statusFilter
  })

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="60d">Ultimos 60 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="on-time">Publicados</SelectItem>
              <SelectItem value="error">Errores</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="draft">Borradores</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatsCard title="Total" value={stats.total} loading={loading} />
        <StatsCard
          title="Publicados"
          value={stats.published}
          loading={loading}
          icon={CheckCircle2}
          iconColor="text-green-500"
        />
        <StatsCard
          title="Errores"
          value={stats.errors}
          loading={loading}
          icon={XCircle}
          iconColor="text-red-500"
          highlight={stats.errors > 0}
        />
        <StatsCard
          title="Pendientes"
          value={stats.pending}
          loading={loading}
          icon={Clock}
          iconColor="text-yellow-500"
        />
        <StatsCard
          title="Tasa de exito"
          value={`${stats.successRate}%`}
          loading={loading}
          icon={CheckCircle2}
          iconColor={stats.successRate >= 90 ? 'text-green-500' : stats.successRate >= 70 ? 'text-yellow-500' : 'text-red-500'}
        />
      </div>

      {/* Post List */}
      {!loading && filtered.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Posts programados ({filtered.length})
            </CardTitle>
            <CardDescription>
              Verificacion de publicacion por plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filtered.map((v) => {
              const config = statusConfig[v.overallStatus]
              const StatusIcon = config.icon
              const isExpanded = expandedId === v.post.id

              return (
                <div
                  key={v.post.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                >
                  <div
                    className="flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : v.post.id)}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <StatusIcon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm line-clamp-1 font-medium">
                          {v.post.text || '(sin texto)'}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(v.scheduledTime)}
                          </span>
                          <Badge variant="outline" className={`text-xs ${config.bg}`}>
                            {config.label}
                          </Badge>
                          {v.providers.map((prov) => (
                            <Badge
                              key={prov.network}
                              variant="outline"
                              className={`text-xs ${networkColors[prov.network] ?? ''}`}
                            >
                              {prov.network}
                              {prov.isPublished && ' ✓'}
                              {prov.isError && ' ✗'}
                              {prov.isPending && ' ⏳'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-4 ml-8 space-y-3">
                      {/* Full caption */}
                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="text-sm whitespace-pre-line">{v.post.text}</p>
                      </div>

                      {/* Provider details */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">
                          Detalles por plataforma
                        </p>
                        {v.providers.map((prov) => (
                          <div
                            key={prov.network}
                            className="flex items-center justify-between rounded-md border p-3"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={networkColors[prov.network] ?? ''}
                              >
                                {prov.network}
                              </Badge>
                              {prov.isPublished && (
                                <span className="text-xs text-green-500 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Publicado
                                </span>
                              )}
                              {prov.isError && (
                                <span className="text-xs text-red-500 flex items-center gap-1">
                                  <XCircle className="h-3 w-3" /> Error
                                </span>
                              )}
                              {prov.isPending && (
                                <span className="text-xs text-yellow-500 flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Pendiente
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {prov.isError && prov.detailedStatus && (
                                <span className="text-xs text-red-400 max-w-[300px] truncate">
                                  {prov.detailedStatus}
                                </span>
                              )}
                              {prov.publicUrl && prov.isPublished && (
                                <a
                                  href={prov.publicUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Ver post
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Metadata */}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>ID: {v.post.id}</span>
                        <span>Auto-publish: {v.post.autoPublish ? 'Si' : 'No'}</span>
                        <span>Programado: {v.scheduledTime} ({v.timezone})</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p className="text-lg font-medium">No hay posts programados</p>
          <p className="text-sm mt-1">No se encontraron posts en el rango seleccionado</p>
        </div>
      )}
    </div>
  )
}

function formatDateTime(dateTime: string): string {
  try {
    const d = new Date(dateTime)
    return d.toLocaleDateString('es-PR', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return dateTime
  }
}

function StatsCard({
  title,
  value,
  loading,
  icon: Icon,
  iconColor,
  highlight,
}: {
  title: string
  value: number | string
  loading: boolean
  icon?: React.ElementType
  iconColor?: string
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-red-500/30' : ''}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-12 mt-1" />
            ) : (
              <p className={`text-2xl font-bold ${highlight ? 'text-red-500' : ''}`}>
                {value}
              </p>
            )}
          </div>
          {Icon && (
            <Icon className={`h-5 w-5 ${iconColor ?? 'text-muted-foreground'}`} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
