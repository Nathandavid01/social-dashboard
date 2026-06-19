'use client'

import { useState, useMemo, useTransition } from 'react'
import type { Client, Profile, RecordingSession, ContentIdea } from '@/lib/supabase/types'
import { createRecordingSession, updateRecordingSession, deleteRecordingSession } from '@/lib/actions/recording-sessions'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import { userAccent } from '@/lib/utils/user-accent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { GpsPicker } from './gps-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SessionIdeasPanel } from '@/components/recording/session-ideas-panel'
import {
  Camera,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Clock,
  MapPin,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  X,
  CalendarDays,
  List,
  BookOpen,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  isSameDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { friendlyError } from '@/lib/utils/error-message'

// ── Types ────────────────────────────────────────────────────────────────────

interface ExtendedSession extends RecordingSession {
  client?: Pick<Client, 'id' | 'name'> | null
  videographer?: Pick<Profile, 'id' | 'full_name'> | null
}

interface RecordingCalendarClientProps {
  initialSessions: ExtendedSession[]
  clients: Pick<Client, 'id' | 'name'>[]
  teamMembers: Pick<Profile, 'id' | 'full_name'>[]
  clientIdeasMap: Record<string, ContentIdea[]>  // clientId → ideas
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Programada', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  completed: { label: 'Completada', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' },
  cancelled: { label: 'Cancelada', color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' },
}

// ── Add/Edit Session Dialog ──────────────────────────────────────────────────

interface SessionDialogProps {
  open: boolean
  onClose: () => void
  onSaved: (session: ExtendedSession) => void
  clients: Pick<Client, 'id' | 'name'>[]
  teamMembers: Pick<Profile, 'id' | 'full_name'>[]
  defaultDate?: string
  editing?: ExtendedSession
}

function SessionDialog({ open, onClose, onSaved, clients, teamMembers, defaultDate, editing }: SessionDialogProps) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const [date, setDate] = useState(editing?.session_date ?? defaultDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [clientId, setClientId] = useState(editing?.client_id ?? 'none')
  const [videographerId, setVideographerId] = useState(editing?.videographer_id ?? 'none')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [startTime, setStartTime] = useState(editing?.start_time ?? '')
  const [endTime, setEndTime] = useState(editing?.end_time ?? '')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [locationAddress, setLocationAddress] = useState(editing?.location_address ?? '')
  const [locationLat, setLocationLat] = useState<number | null>(editing?.location_lat ?? null)
  const [locationLng, setLocationLng] = useState<number | null>(editing?.location_lng ?? null)
  const [notes, setNotes] = useState(editing?.notes ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      const values = {
        session_date: date,
        client_id: clientId === 'none' ? null : clientId,
        videographer_id: videographerId === 'none' ? null : videographerId,
        title: title.trim(),
        start_time: startTime || null,
        end_time: endTime || null,
        location: location || null,
        location_address: locationAddress || null,
        location_lat: locationLat,
        location_lng: locationLng,
        notes: notes || null,
      }
      if (editing) {
        const result = await updateRecordingSession(editing.id, values)
        if (result.error) { toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' }); return }
        const client = clients.find((c) => c.id === values.client_id) ?? null
        const videographer = teamMembers.find((m) => m.id === values.videographer_id) ?? null
        onSaved({ ...editing, ...values, client, videographer })
      } else {
        const result = await createRecordingSession(values)
        if (result.error) { toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' }); return }
        // Optimistic: create a temp session object
        const client = clients.find((c) => c.id === values.client_id) ?? null
        const videographer = teamMembers.find((m) => m.id === values.videographer_id) ?? null
        onSaved({
          id: Math.random().toString(),
          status: 'scheduled',
          created_by: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...values,
          client,
          videographer,
        } as ExtendedSession)
      }
      toast({ title: editing ? 'Sesión actualizada' : 'Sesión agregada' })
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {editing ? 'Editar Sesión de Grabación' : 'Nueva Sesión de Grabación'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Título de la Sesión *</Label>
            <Input autoFocus placeholder="p.ej. Sesión de Marca — Casita Vieja" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Fecha *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Tipo de ubicación</Label>
              <Input placeholder="Estudio, en sitio..." value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <GpsPicker
            address={locationAddress}
            lat={locationLat}
            lng={locationLng}
            onChange={({ address, lat, lng }) => {
              setLocationAddress(address)
              setLocationLat(lat)
              setLocationLng(lng)
            }}
            compact
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Hora de Inicio</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hora de Fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Building2 className="h-3 w-3" /> Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Sin cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cliente</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Videógrafo</Label>
            <Select value={videographerId} onValueChange={setVideographerId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {teamMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Textarea placeholder="Lista de tomas, requisitos especiales..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={isPending || !title.trim()}>
              {isPending ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Agregar Sesión'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Session Card (List View) ─────────────────────────────────────────────────

function SessionCard({
  session,
  onEdit,
  onStatusChange,
  onDelete,
  onOpenIdeas,
  ideaCount,
}: {
  session: ExtendedSession
  onEdit: () => void
  onStatusChange: (status: string) => void
  onDelete: () => void
  onOpenIdeas: () => void
  ideaCount: number
}) {
  const sc = statusConfig[session.status] ?? statusConfig.scheduled

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/20 transition-colors group">
      <Camera className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-medium">{session.title}</p>
          <Badge variant="outline" className={cn('text-[10px]', sc.bg, sc.color)}>{sc.label}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {session.client && (
            <span className="flex items-center gap-1 text-primary font-medium">
              <Building2 className="h-3 w-3" />
              {session.client.name}
            </span>
          )}
          {session.videographer && (
            <span className="flex items-center gap-1">
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">{initials(session.videographer.full_name)}</AvatarFallback>
              </Avatar>
              {session.videographer.full_name}
            </span>
          )}
          {session.start_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {session.start_time.slice(0, 5)}{session.end_time && ` – ${session.end_time.slice(0, 5)}`}
            </span>
          )}
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {session.location}
            </span>
          )}
          {(session.location_lat != null && session.location_lng != null) || session.location_address ? (
            <a
              href={`https://www.google.com/maps?q=${
                session.location_lat != null && session.location_lng != null
                  ? `${session.location_lat},${session.location_lng}`
                  : encodeURIComponent(session.location_address ?? '')
              }`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-600 transition-colors hover:bg-green-500/20"
              title={session.location_address ?? 'Abrir en Maps'}
            >
              <MapPin className="h-3 w-3" /> {session.location_address ? 'Dirección' : 'GPS'}
            </a>
          ) : null}
        </div>
        {session.notes && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">{session.notes}</p>
        )}
        {/* Ideas button */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenIdeas() }}
          className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          {ideaCount > 0 ? `${ideaCount} idea${ideaCount !== 1 ? 's' : ''} asignada${ideaCount !== 1 ? 's' : ''}` : 'Ver checklist de ideas'}
        </button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenIdeas}>
            <BookOpen className="mr-2 h-4 w-4" /> Ideas / Checklist
          </DropdownMenuItem>
          {session.status !== 'completed' && (
            <DropdownMenuItem onClick={() => onStatusChange('completed')}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Marcar Completada
            </DropdownMenuItem>
          )}
          {session.status !== 'cancelled' && (
            <DropdownMenuItem onClick={() => onStatusChange('cancelled')}>
              <X className="mr-2 h-4 w-4 text-muted-foreground" /> Cancelar Sesión
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function RecordingCalendarClient({ initialSessions, clients, teamMembers, clientIdeasMap }: RecordingCalendarClientProps) {
  const [sessions, setSessions] = useState<ExtendedSession[]>(initialSessions)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [search, setSearch] = useState('')
  const [filterVideographer, setFilterVideographer] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [isPending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [addDate, setAddDate] = useState<string | undefined>()
  const [editing, setEditing] = useState<ExtendedSession | undefined>()
  const [ideasSession, setIdeasSession] = useState<ExtendedSession | undefined>()
  const [ideasMap, setIdeasMap] = useState<Record<string, ContentIdea[]>>(clientIdeasMap)
  const { toast } = useToast()

  // Calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDow = (monthStart.getDay() + 6) % 7
  const paddedDays = [...Array(startDow).fill(null), ...days]

  // Filtered sessions
  const filtered = useMemo(() => {
    let result = sessions
    if (filterVideographer !== 'all') result = result.filter((s) => s.videographer_id === filterVideographer)
    if (filterClient !== 'all') result = result.filter((s) => s.client_id === filterClient)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.client?.name?.toLowerCase().includes(q) ||
        s.videographer?.full_name?.toLowerCase().includes(q) ||
        s.location?.toLowerCase().includes(q)
      )
    }
    return result
  }, [sessions, filterVideographer, filterClient, search])

  function sessionsForDay(day: Date) {
    return filtered.filter((s) => isSameDay(parseISO(s.session_date), day))
  }

  // This month's sessions for list view
  const monthSessions = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM')
    return filtered.filter((s) => s.session_date.startsWith(monthStr))
  }, [filtered, currentMonth])

  // Group list view by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, ExtendedSession[]> = {}
    for (const s of monthSessions) {
      if (!groups[s.session_date]) groups[s.session_date] = []
      groups[s.session_date].push(s)
    }
    return groups
  }, [monthSessions])

  function handleSaved(session: ExtendedSession) {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = session
        return next
      }
      return [...prev, session].sort((a, b) => a.session_date.localeCompare(b.session_date))
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta sesión de grabación?')) return
    setSessions((prev) => prev.filter((s) => s.id !== id))
    startTransition(async () => {
      const result = await deleteRecordingSession(id)
      if (result.error) toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
    })
  }

  function handleStatusChange(id: string, status: string) {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: status as RecordingSession['status'] } : s))
    startTransition(async () => {
      await updateRecordingSession(id, { status })
    })
  }

  const hasFilters = search.trim() !== '' || filterVideographer !== 'all' || filterClient !== 'all'

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 text-foreground sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-amber-600 text-black shadow-lg shadow-primary/20">
            <Camera className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">Calendario de Grabación</h1>
            <p className="text-[11px] text-muted-foreground">Todas las grabaciones agendadas · color por videógrafo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <button
              onClick={() => setView('calendar')}
              className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', view === 'calendar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendario
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
          <button onClick={() => { setAddDate(undefined); setShowAdd(true) }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-black transition hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> Agregar sesión
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, cliente, videógrafo, ubicación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={filterVideographer} onValueChange={setFilterVideographer}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-[160px]">
            <SelectValue placeholder="Todos los videógrafos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los videógrafos</SelectItem>
            {teamMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-[160px]">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearch(''); setFilterVideographer('all'); setFilterClient('all') }}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Videographer color legend */}
      {teamMembers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Videógrafos</span>
          {teamMembers.map((m) => {
            const a = userAccent(m.id)
            return (
              <span key={m.id} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.dot }} />
                {m.full_name}
              </span>
            )
          })}
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold capitalize">{format(currentMonth, 'MMMM yyyy', { locale: es })}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {view === 'calendar' ? (
        <div className="space-y-3">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 text-center">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="text-[10px] font-semibold text-muted-foreground pb-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {paddedDays.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />
              const daySessions = sessionsForDay(day)
              const dateStr = format(day, 'yyyy-MM-dd')
              const isCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <div
                  key={dateStr}
                  className={cn(
                    'group min-h-[96px] cursor-pointer rounded-lg border p-2 transition-colors',
                    isToday(day) ? 'border-primary/40 bg-primary/[0.06]' : 'border-border bg-muted/20 hover:border-primary/40',
                    !isCurrentMonth && 'opacity-30',
                  )}
                  onClick={() => { setAddDate(dateStr); setShowAdd(true) }}
                >
                  {/* Date number */}
                  <div className={cn(
                    'mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    isToday(day) ? 'bg-primary text-black' : 'text-muted-foreground',
                  )}>
                    {format(day, 'd')}
                  </div>

                  {/* Sessions — colored by videographer */}
                  <div className="space-y-1">
                    {daySessions.slice(0, 3).map((session) => {
                      const a = userAccent(session.videographer_id)
                      const clientIdeas = session.client_id ? (ideasMap[session.client_id] ?? []) : []
                      const sessionIdeaCount = clientIdeas.filter((i) => i.recording_session_id === session.id).length
                      return (
                        <div
                          key={session.id}
                          className="cursor-pointer rounded-md px-1.5 py-1 text-[9px] leading-tight transition hover:opacity-80"
                          style={{ backgroundColor: a.soft, boxShadow: `inset 2px 0 0 0 ${a.dot}` }}
                          onClick={(e) => { e.stopPropagation(); setIdeasSession(session) }}
                        >
                          <p className="truncate font-semibold" style={{ color: a.text }}>{session.title}</p>
                          {session.client && (
                            <p className="truncate text-muted-foreground">{session.client.name}</p>
                          )}
                          {sessionIdeaCount > 0 && (
                            <p className="text-muted-foreground">{sessionIdeaCount} ideas</p>
                          )}
                        </div>
                      )
                    })}
                    {daySessions.length > 3 && (
                      <p className="pl-0.5 text-[9px] text-muted-foreground">+{daySessions.length - 3} más</p>
                    )}
                  </div>

                  {daySessions.length === 0 && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-muted-foreground mt-2">
                      <Plus className="h-3 w-3 mr-0.5" /> Agregar
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* List view — grouped by date */
        <div className="space-y-5">
          {Object.keys(groupedByDate).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Camera className="mx-auto h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm">Sin sesiones de grabación este mes</p>
              <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5" /> Agregar Sesión
              </Button>
            </div>
          ) : (
            Object.entries(groupedByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([dateStr, daySessions]) => (
                <div key={dateStr} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className={cn(
                      'text-xs font-semibold uppercase tracking-wide',
                      isToday(parseISO(dateStr)) ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {format(parseISO(dateStr), "EEEE, d 'de' MMMM", { locale: es })}
                      {isToday(parseISO(dateStr)) && <span className="ml-1.5 text-primary">· Hoy</span>}
                    </h3>
                    <div className="flex-1 border-t border-border" />
                    <span className="text-xs text-muted-foreground">{daySessions.length} sesión{daySessions.length !== 1 ? 'es' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {daySessions.map((session) => {
                      const clientIdeas = session.client_id ? (ideasMap[session.client_id] ?? []) : []
                      const sessionIdeaCount = clientIdeas.filter((i) => i.recording_session_id === session.id).length
                      return (
                        <SessionCard
                          key={session.id}
                          session={session}
                          onEdit={() => { setEditing(session); setShowAdd(true) }}
                          onStatusChange={(status) => handleStatusChange(session.id, status)}
                          onDelete={() => handleDelete(session.id)}
                          onOpenIdeas={() => setIdeasSession(session)}
                          ideaCount={sessionIdeaCount}
                        />
                      )
                    })}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      <SessionDialog
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditing(undefined); setAddDate(undefined) }}
        onSaved={handleSaved}
        clients={clients}
        teamMembers={teamMembers}
        defaultDate={addDate}
        editing={editing}
      />

      {ideasSession && (
        <SessionIdeasPanel
          open={!!ideasSession}
          onClose={() => setIdeasSession(undefined)}
          session={ideasSession}
          clientIdeas={ideasSession.client_id ? (ideasMap[ideasSession.client_id] ?? []) : []}
          onIdeasChange={(updated) => {
            if (!ideasSession.client_id) return
            setIdeasMap((prev) => ({ ...prev, [ideasSession.client_id!]: updated }))
          }}
        />
      )}
    </div>
  )
}
