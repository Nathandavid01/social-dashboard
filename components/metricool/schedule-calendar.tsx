'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/lib/hooks/use-toast'
import { getStoredConfig } from '@/lib/metricool/client'
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
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'

const DAYS_ES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13.2a8.2 8.2 0 005.58 2.18V12a4.81 4.81 0 01-3.77-1.54V6.69h3.77z" />
    </svg>
  )
}

const networkIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
}

const networkIconColors: Record<string, string> = {
  facebook: 'text-blue-500',
  instagram: 'text-pink-500',
  tiktok: 'text-cyan-400',
  twitter: 'text-neutral-400',
  linkedin: 'text-sky-500',
  youtube: 'text-red-500',
}

export function ScheduleCalendar() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [verifications, setVerifications] = useState<ScheduleVerification[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const config = getStoredConfig()
    if (!config) {
      setError('No hay credenciales de Metricool. Ve a la seccion de Metricool primero.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0, 23, 59, 59)
    const fmt = (d: Date) => d.toISOString().split('.')[0]

    try {
      const posts = await getScheduledPosts(config, fmt(start), fmt(end))
      const verified = verifySchedule(posts)
      verified.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
      setVerifications(verified)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const stats = getScheduleStats(verifications)

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Monday = 0 in our grid
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = []

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push({
        date: formatDateKey(d),
        day: d.getDate(),
        isCurrentMonth: false,
      })
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d)
      days.push({
        date: formatDateKey(date),
        day: d,
        isCurrentMonth: true,
      })
    }

    // Next month padding
    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const date = new Date(year, month + 1, d)
        days.push({
          date: formatDateKey(date),
          day: d,
          isCurrentMonth: false,
        })
      }
    }

    return days
  }, [currentMonth])

  // Group verifications by date
  const postsByDate = useMemo(() => {
    const map: Record<string, ScheduleVerification[]> = {}
    verifications.forEach((v) => {
      const dateKey = v.scheduledTime.split('T')[0]
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(v)
    })
    return map
  }, [verifications])

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))

  const today = formatDateKey(new Date())
  const selectedPosts = selectedDay ? postsByDate[selectedDay] ?? [] : []

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Total" value={stats.total} />
          <MiniStat label="Publicados" value={stats.published} color="text-green-500" />
          <MiniStat label="Errores" value={stats.errors} color="text-red-500" />
          <MiniStat label="Tasa exito" value={`${stats.successRate}%`} color={stats.successRate >= 90 ? 'text-green-500' : 'text-red-500'} />
        </div>

        {/* Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base min-w-[180px] text-center">
                  {MONTHS_ES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAYS_ES.map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map(({ date, day, isCurrentMonth }) => {
                    const dayPosts = postsByDate[date] ?? []
                    const isToday = date === today
                    const isSelected = date === selectedDay
                    const hasErrors = dayPosts.some((p) => p.overallStatus === 'error')
                    const hasPending = dayPosts.some((p) => p.overallStatus === 'pending')
                    const allPublished = dayPosts.length > 0 && dayPosts.every((p) => p.overallStatus === 'on-time')

                    return (
                      <div
                        key={date}
                        onClick={() => dayPosts.length > 0 && setSelectedDay(isSelected ? null : date)}
                        className={`
                          min-h-[90px] rounded-lg border p-1.5 transition-colors
                          ${!isCurrentMonth ? 'opacity-30' : ''}
                          ${isToday ? 'border-primary' : 'border-border'}
                          ${isSelected ? 'bg-primary/5 border-primary' : ''}
                          ${dayPosts.length > 0 ? 'cursor-pointer hover:bg-muted/50' : ''}
                          ${hasErrors ? 'border-red-500/40' : ''}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                            {day}
                          </span>
                          {dayPosts.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {dayPosts.length}
                            </span>
                          )}
                        </div>

                        {/* Post indicators */}
                        {dayPosts.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {dayPosts.slice(0, 3).map((v) => (
                              <Tooltip key={v.post.id}>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 rounded px-1 py-0.5 bg-muted/50">
                                    {/* Status dot */}
                                    {v.overallStatus === 'on-time' && (
                                      <CheckCircle2 className="h-2.5 w-2.5 text-green-500 shrink-0" />
                                    )}
                                    {v.overallStatus === 'error' && (
                                      <XCircle className="h-2.5 w-2.5 text-red-500 shrink-0" />
                                    )}
                                    {v.overallStatus === 'pending' && (
                                      <Clock className="h-2.5 w-2.5 text-yellow-500 shrink-0" />
                                    )}

                                    {/* Platform icons */}
                                    {v.providers.map((prov) => {
                                      const IconComp = networkIcons[prov.network]
                                      if (IconComp) {
                                        return (
                                          <IconComp
                                            key={prov.network}
                                            className={`h-2.5 w-2.5 shrink-0 ${networkIconColors[prov.network] ?? ''}`}
                                          />
                                        )
                                      }
                                      return (
                                        <span key={prov.network} className={`text-[8px] ${networkIconColors[prov.network] ?? ''}`}>
                                          {prov.network[0].toUpperCase()}
                                        </span>
                                      )
                                    })}

                                    {/* Time */}
                                    <span className="text-[9px] text-muted-foreground truncate">
                                      {v.scheduledTime.split('T')[1]?.slice(0, 5)}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px]">
                                  <p className="text-xs line-clamp-2">{v.post.text}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {dayPosts.length > 3 && (
                              <span className="text-[9px] text-muted-foreground px-1">
                                +{dayPosts.length - 3} mas
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Selected day details */}
        {selectedDay && selectedPosts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {formatDisplayDate(selectedDay)} — {selectedPosts.length} post{selectedPosts.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedPosts.map((v) => (
                <div key={v.post.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm whitespace-pre-line line-clamp-3 flex-1">{v.post.text}</p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {v.scheduledTime.split('T')[1]?.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {v.providers.map((prov) => {
                      const IconComp = networkIcons[prov.network]
                      return (
                        <div
                          key={prov.network}
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border ${
                            prov.isPublished
                              ? 'bg-green-500/10 border-green-500/20'
                              : prov.isError
                              ? 'bg-red-500/10 border-red-500/20'
                              : 'bg-yellow-500/10 border-yellow-500/20'
                          }`}
                        >
                          {IconComp && (
                            <IconComp className={`h-3.5 w-3.5 ${networkIconColors[prov.network]}`} />
                          )}
                          <span className="capitalize">{prov.network}</span>
                          {prov.isPublished && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                          {prov.isError && <XCircle className="h-3 w-3 text-red-500" />}
                          {prov.isPending && <Clock className="h-3 w-3 text-yellow-500" />}
                          {prov.publicUrl && prov.isPublished && (
                            <a
                              href={prov.publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3 text-primary" />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {v.providers.some((p) => p.isError) && (
                    <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
                      {v.providers.find((p) => p.isError)?.detailedStatus}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Publicado</span>
          <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" /> Error</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-yellow-500" /> Pendiente</span>
          <span className="flex items-center gap-1"><FacebookIcon className="h-3 w-3 text-blue-500" /> Facebook</span>
          <span className="flex items-center gap-1"><InstagramIcon className="h-3 w-3 text-pink-500" /> Instagram</span>
        </div>
      </div>
    </TooltipProvider>
  )
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-PR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${color ?? ''}`}>{value}</p>
    </div>
  )
}
