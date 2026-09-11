'use client'

import { clientDisplayName } from '@/lib/utils/client-display-name'
import { RecordingMap } from './recording-map'
import { RecordingPending } from './recording-pending'
import { requiredForOnsite } from '@/lib/onsite/slot-count'
import { useState, useMemo, useTransition, useEffect } from 'react'
import type { Client, Profile, RecordingSession, ContentIdea, RecordingConfirmationStatus } from '@/lib/supabase/types'
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
import { useHasPermission, useCurrentUserId } from '@/components/auth/role-gate'
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
  Pencil,
  Trash2,
  CheckCircle2,
  X,
  CalendarDays,
  List,
  BookOpen,
  ExternalLink,
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
import {
  isRecordingSessionComplete,
  isRecordingSessionIncomplete,
  resolveConfirmationStatus,
} from '@/lib/utils/recording-confirmation'
import { videographerConflictsInRange } from '@/lib/utils/videographer-conflicts'
import { GOOGLE_CALENDAR_HOME_URL, sessionsToIcs } from '@/lib/utils/google-calendar'

// ── Types ────────────────────────────────────────────────────────────────────

interface ExtendedSession extends RecordingSession {
  client?: Pick<Client, 'id' | 'name'> | null
  videographer?: Pick<Profile, 'id' | 'full_name'> | null
}

interface RecordingCalendarClientProps {
  initialVideographer?: string
  initialSessions: ExtendedSession[]
  clients: (Pick<Client, 'id' | 'name'> & Partial<Pick<Client, 'posting_days' | 'assigned_to'>>)[]
  teamMembers: Pick<Profile, 'id' | 'full_name'>[]
  clientIdeasMap: Record<string, ContentIdea[]>  // clientId → ideas
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function normalizePersonName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\b(?:dra?|sra?|lic(?:da|do)?|ing)\.?\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const GENERIC_RECORDING_TITLE = /^(?:recording|grabaci[oó]n)$/i
const RECORDING_TITLE_PREFIX = /^(?:recording|grabaci[oó]n)\s*[-–:]\s*/i
const RECORDING_TITLE_SUFFIX = /\s*[-–:]\s*(?:recording|grabaci[oó]n)$/i

function clientLabelFromTitle(title?: string | null): string | null {
  const raw = title?.trim() ?? ''
  if (!raw) return null
  const stripped = raw.replace(RECORDING_TITLE_PREFIX, '').replace(RECORDING_TITLE_SUFFIX, '').trim()
  if (!stripped || GENERIC_RECORDING_TITLE.test(stripped)) return null
  return stripped
}

/** Nombre visible del chip: cliente, lista, título-si-es-cliente, o “Sin cliente”. */
export function sessionChipClientLabel(
  session: { client?: { name?: string | null } | null; client_id?: string | null; title?: string | null },
  clients: (Pick<Client, 'id' | 'name'> & Partial<Pick<Client, 'posting_days' | 'assigned_to'>>)[] = [],
): string {
  const fromJoin = session.client?.name?.trim()
  if (fromJoin) return clientDisplayName(fromJoin)
  const fromList = session.client_id
    ? clients.find((c) => c.id === session.client_id)?.name?.trim()
    : undefined
  if (fromList) return clientDisplayName(fromList)
  return clientDisplayName(clientLabelFromTitle(session.title) ?? 'Sin Cliente')
}

/** Videógrafo y cliente se leen como la misma persona (p. ej. Delian / Dra. Delian). */
export function namesLookLikeSamePerson(left?: string | null, right?: string | null): boolean {
  if (!left?.trim() || !right?.trim()) return false
  const a = normalizePersonName(left)
  const b = normalizePersonName(right)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Programada', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  completed: { label: 'Completada', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' },
  cancelled: { label: 'Cancelada', color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' },
}

const confirmationConfig: Record<RecordingConfirmationStatus, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmada', color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  unconfirmed: { label: 'Sin confirmar', color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20' },
}

type ConfirmationFilter = 'all' | 'confirmed' | 'unconfirmed' | 'incomplete'

// ── Add/Edit Session Dialog ──────────────────────────────────────────────────

interface SessionDialogProps {
  open: boolean
  onClose: () => void
  onSaved: (session: ExtendedSession) => void
  clients: (Pick<Client, 'id' | 'name'> & Partial<Pick<Client, 'posting_days' | 'assigned_to'>>)[]
  teamMembers: Pick<Profile, 'id' | 'full_name'>[]
  defaultDate?: string
  editing?: ExtendedSession
}

export function SessionDialog({ open, onClose, onSaved, clients, teamMembers, defaultDate, editing }: SessionDialogProps) {
  const canAssign = useHasPermission('recording.brief')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const [date, setDate] = useState(editing?.session_date ?? defaultDate ?? format(new Date(), 'yyyy-MM-dd'))
  const [clientId, setClientId] = useState(editing?.client_id ?? 'none')
  const [videographerId, setVideographerId] = useState(editing?.videographer_id ?? 'none')
  const selectedClient = clients.find(c => c.id === clientId)
  const title = selectedClient?.name ?? ''
  const target = requiredForOnsite({ postingDays: selectedClient?.posting_days, ref: date ? new Date(date + 'T12:00:00') : new Date() })
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
        title: title.trim(),
        start_time: startTime || null,
        end_time: endTime || null,
        notes: notes || null,
        ...(canAssign ? {
          videographer_id: videographerId === 'none' ? null : videographerId,
          location: location || null,
          location_address: locationAddress || null,
          location_lat: locationLat,
          location_lng: locationLng,
        } : {}),
      }
      let warning: string | undefined
      if (editing) {
        const result = await updateRecordingSession(editing.id, values)
        if (result.error) { toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' }); return }
        warning = result.warning
        const client = clients.find((c) => c.id === values.client_id) ?? null
        const videographer = teamMembers.find((m) => m.id === values.videographer_id) ?? null
        const confirmation_status = resolveConfirmationStatus({
          client_id: values.client_id,
          videographer_id: values.videographer_id ?? editing.videographer_id,
          start_time: values.start_time,
        })
        onSaved({ ...editing, ...values, confirmation_status, client, videographer })
      } else {
        const result = await createRecordingSession(values)
        if (result.error) { toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' }); return }
        // Optimistic: create a temp session object
        warning = result.warning
        const client = clients.find((c) => c.id === values.client_id) ?? null
        const videographer = teamMembers.find((m) => m.id === values.videographer_id) ?? null
        const confirmation_status = resolveConfirmationStatus({
          client_id: values.client_id,
          videographer_id: values.videographer_id,
          start_time: values.start_time,
        })
        onSaved({
          id: result.id!,
          status: 'scheduled',
          confirmation_status,
          created_by: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...values,
          client,
          videographer,
        } as ExtendedSession)
      }
      toast({ title: editing ? 'Sesión actualizada' : 'Sesión agregada', description: warning })
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent surface="raised" className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {editing ? 'Editar Sesión de Grabación' : 'Nueva Sesión de Grabación'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1"><Building2 className="h-3 w-3" /> Cliente *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger aria-label="Cliente" className="h-9"><SelectValue placeholder="Sin cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cliente</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{clientDisplayName(c.name)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="session-client-title" className="text-xs">Título de la Sesión</Label>
            <Input id="session-client-title" readOnly placeholder="Selecciona Un Cliente" value={title} />
            <p className="text-xs text-muted-foreground">Se usa automáticamente el nombre del cliente.</p>
          </div>

          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3" aria-live="polite">
            <p className="font-semibold text-violet-600 dark:text-violet-300">{target.slotTarget > 0 ? `${target.slotTarget} Videos Para Grabar` : 'Videos Por Definir'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{!selectedClient ? 'Selecciona El Cliente Para Ver La Meta De Grabación.' : !target.slotTarget ? 'Configura Los Días De Publicación Del Cliente Para Calcular La Meta.' : `${target.perMonth} publicaciones en el mes de la sesión × 1.5. Meta recomendada de On Site.`}</p>
          </div>
          <div className={cn('grid gap-3', canAssign ? 'grid-cols-2' : 'grid-cols-1')}>
            <div className="space-y-1.5">
              <Label htmlFor="rc-fecha" className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Fecha *</Label>
              <Input id="rc-fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            {canAssign && (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Tipo de ubicación</Label>
                <Input placeholder="Estudio, en sitio..." value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 text-sm" />
              </div>
            )}
          </div>

          {canAssign && (
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
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="recording-start-time" className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Hora de Inicio</Label>
              <Input id="recording-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recording-end-time" className="text-xs">Hora de Fin</Label>
              <Input id="recording-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>



          {canAssign && (
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
          )}

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
  onConfirmationChange,
  onDelete,
  onOpenIdeas,
  ideaCount,
  editorName,
}: {
  session: ExtendedSession
  onEdit: () => void
  onStatusChange: (status: string) => void
  onConfirmationChange: (status: RecordingConfirmationStatus) => void
  onDelete: () => void
  onOpenIdeas: () => void
  ideaCount: number
  editorName: string
}) {
  const sc = statusConfig[session.status] ?? statusConfig.scheduled
  const confirmation = session.confirmation_status ?? 'unconfirmed'
  const cc = confirmationConfig[confirmation]

  return (
    <div
      role="button"
      tabIndex={0}
      data-slot="session-card"
      onClick={onOpenIdeas}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenIdeas()
        }
      }}
      className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/20 transition-colors group cursor-pointer"
    >
      <Camera className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-medium">{clientDisplayName(session.title)}</p>
          <Badge variant="outline" className={cn('text-[10px]', sc.bg, sc.color)}>{sc.label}</Badge>
          <Badge variant="outline" className={cn('text-[10px]', cc.bg, cc.color)}>{cc.label}</Badge>
        </div>
        <p className="mb-2 text-xs font-medium text-violet-500">Editor · {editorName}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {session.client && (
            <span className="flex items-center gap-1 text-primary font-medium">
              <Building2 className="h-3 w-3" />
              {clientDisplayName(session.client.name)}
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
          {!session.videographer_id && <span className="text-amber-500">Asignar Videógrafo</span>}
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
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenIdeas() }}
          className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          {ideaCount > 0 ? `${ideaCount} idea${ideaCount !== 1 ? 's' : ''} asignada${ideaCount !== 1 ? 's' : ''}` : 'Ver checklist de ideas'}
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs opacity-100"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-100" aria-label="Más acciones">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenIdeas}>
              <BookOpen className="mr-2 h-4 w-4" /> Ideas / Checklist
            </DropdownMenuItem>
            {confirmation !== 'confirmed' && (
              <DropdownMenuItem onClick={() => onConfirmationChange('confirmed')}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> Confirmar
              </DropdownMenuItem>
            )}
            {confirmation === 'confirmed' && (
              <DropdownMenuItem onClick={() => onConfirmationChange('unconfirmed')}>
                <X className="mr-2 h-4 w-4 text-amber-500" /> Unconfirmar
              </DropdownMenuItem>
            )}
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
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function RecordingCalendarClient({ initialSessions, clients, teamMembers, clientIdeasMap, initialVideographer }: RecordingCalendarClientProps) {
  const canAssign = useHasPermission('recording.brief')
  const [sessions, setSessions] = useState<ExtendedSession[]>(initialSessions)
  const [compact, setCompact] = useState(false)
  const [expandedDays, setExpandedDays] = useState<string[]>([])
  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setCompact(media.matches)
    update(); media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const [view, setView] = useState<'calendar' | 'list' | 'map'>('calendar')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [search, setSearch] = useState('')
  const currentUserId = useCurrentUserId()
  const [filterVideographer, setFilterVideographer] = useState(initialVideographer ?? (canAssign ? 'all' : currentUserId ?? 'all'))
  const [filterClient, setFilterClient] = useState('all')
  const [filterConfirmation, setFilterConfirmation] = useState<ConfirmationFilter>('all')
  const [isPending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [addDate, setAddDate] = useState<string | undefined>()
  const [editing, setEditing] = useState<ExtendedSession | undefined>()
  const [ideasSession, setIdeasSession] = useState<ExtendedSession | undefined>()
  const [ideasMap, setIdeasMap] = useState<Record<string, ContentIdea[]>>(clientIdeasMap)
  useEffect(() => { setSessions(initialSessions) }, [initialSessions])
  useEffect(() => { setIdeasMap(clientIdeasMap) }, [clientIdeasMap])
  const { toast } = useToast()
  const conflicts = useMemo(
    () => videographerConflictsInRange(sessions, currentMonth),
    [sessions, currentMonth],
  )

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
    if (filterConfirmation === 'confirmed') {
      result = result.filter((s) => (s.confirmation_status ?? 'unconfirmed') === 'confirmed')
    } else if (filterConfirmation === 'unconfirmed') {
      result = result.filter((s) => (s.confirmation_status ?? 'unconfirmed') === 'unconfirmed')
    } else if (filterConfirmation === 'incomplete') {
      result = result.filter((s) => isRecordingSessionIncomplete(s))
    }
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
  }, [sessions, filterVideographer, filterClient, filterConfirmation, search])

  function editorFor(session: ExtendedSession) {
    if (!session.client_id) return 'Vincula El Cliente'
    const client = clients.find(c=>c.id===session.client_id)
    return client?.assigned_to ? teamMembers.find(m=>m.id===client.assigned_to)?.full_name || 'Nombre No Disponible' : 'Sin Editor Asignado'
  }

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
    setIdeasSession((current) => current?.id === session.id ? session : current)
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

  function handleConfirmationChange(id: string, next: RecordingConfirmationStatus) {
    const session = sessions.find((s) => s.id === id)
    if (!session) return
    if (next === 'confirmed' && !isRecordingSessionComplete(session)) {
      toast({
        title: 'Faltan datos',
        description: 'Para confirmar hace falta cliente, videógrafo y hora de inicio.',
        variant: 'destructive',
      })
      return
    }
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, confirmation_status: next } : s))
    startTransition(async () => {
      const result = await updateRecordingSession(id, { confirmation_status: next })
      if (result.error) {
        toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
        setSessions((prev) => prev.map((s) => s.id === id ? { ...s, confirmation_status: session.confirmation_status ?? 'unconfirmed' } : s))
        return
      }
      toast({ title: next === 'confirmed' ? 'Sesión confirmada' : 'Sesión sin confirmar' })
    })
  }


  function handleAvailabilityPick(sessionId: string, videographerId: string) {
    const nextId = videographerId === 'none' ? null : videographerId
    const videographer = nextId ? teamMembers.find((m) => m.id === nextId) ?? null : null
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, videographer_id: nextId, videographer } : s))
    startTransition(async () => {
      const result = await updateRecordingSession(sessionId, { videographer_id: nextId })
      if (result.error) {
        setSessions(sessions)
        toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
      } else if (result.warning) toast({ title: 'Asignación Guardada', description: result.warning })
    })
  }

  useEffect(() => {
    window.dispatchEvent(new Event('recording-preparation-changed'))
  }, [sessions, ideasMap])

  function downloadMonthIcs() {
    const monthStr = format(currentMonth, 'yyyy-MM')
    const ics = sessionsToIcs(sessions.filter((s) => s.session_date.startsWith(monthStr)))
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grabaciones-${monthStr}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasFilters = search.trim() !== '' || filterVideographer !== 'all' || filterClient !== 'all' || filterConfirmation !== 'all'

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-4 text-foreground sm:p-6">
      <RecordingPending onSelect={(id) => {
        const session = sessions.find(s => s.id === id)
        if (session) setIdeasSession(session)
        else window.location.assign(`/onsite?s=${encodeURIComponent(id)}`)
      }} />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-500">
            <Camera className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">Calendario de Grabación</h1>
            <p className="mt-1 text-sm text-muted-foreground">Organiza las tomas, coordina el equipo y prepara cada sesión.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn('items-center gap-1 rounded-lg border border-border bg-muted/40 p-1', compact ? 'hidden' : 'flex')}>
            <button
              onClick={() => setView('calendar')}
              className={cn('flex items-center gap-1.5 rounded-md min-h-9 px-3 py-1.5 text-xs font-medium transition-colors', view === 'calendar' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <CalendarDays className="h-3.5 w-3.5" /> {compact ? 'Agenda' : 'Calendario'}
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('flex items-center gap-1.5 rounded-md min-h-9 px-3 py-1.5 text-xs font-medium transition-colors', view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
          <button type="button" onClick={()=>setView(view==='map'?'calendar':'map')} className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium',view==='map'?'border-sky-500/40 bg-sky-500/10 text-sky-500':'border-border')}><MapPin className="h-4 w-4"/>{view==='map'?'Cerrar Mapa':'Mapa De Puerto Rico'}</button>
          <a
            href={GOOGLE_CALENDAR_HOME_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Google Calendar
          </a>
          <button
            type="button"
            onClick={downloadMonthIcs}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            Descargar .ics
          </button>
          <button onClick={() => { setAddDate(undefined); setShowAdd(true) }} className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-black transition hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> Agregar sesión
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Resumen Del Mes">
        {[{label:'Sesiones Del Mes',value:monthSessions.length,color:'text-sky-500',bg:'bg-sky-500/5 border-sky-500/20'},
          {label:'Sin Videógrafo',value:monthSessions.filter(s=>!s.videographer_id && !['cancelled','completed'].includes(s.status)).length,color:'text-amber-500',bg:'bg-amber-500/5 border-amber-500/20'},
          {label:'Completadas',value:monthSessions.filter(s=>s.status==='completed').length,color:'text-emerald-500',bg:'bg-emerald-500/5 border-emerald-500/20'}].map(stat=><div key={stat.label} className={cn('rounded-xl border p-3 sm:p-4',stat.bg)}><p className="text-[11px] text-muted-foreground sm:text-xs">{stat.label}</p><p className={cn('mt-1 text-2xl font-semibold tabular-nums',stat.color)}>{stat.value}</p></div>)}

      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, cliente, videógrafo, ubicación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={filterVideographer} onValueChange={setFilterVideographer}>
          <SelectTrigger className="h-11 w-full text-xs sm:w-[190px]">
            <SelectValue placeholder="Todos los videógrafos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los videógrafos</SelectItem>
            {teamMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="h-11 w-full text-xs sm:w-[190px]">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{clientDisplayName(c.name)}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSearch(''); setFilterVideographer('all'); setFilterClient('all'); setFilterConfirmation('all') }}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtro de confirmación">
        {([
          { key: 'all' as const, label: 'Todas', count: sessions.length, dot: '' },
          { key: 'confirmed' as const, label: 'Confirmadas', count: sessions.filter((s) => (s.confirmation_status ?? 'unconfirmed') === 'confirmed').length, dot: 'bg-emerald-500' },
          { key: 'unconfirmed' as const, label: 'Sin confirmar', count: sessions.filter((s) => (s.confirmation_status ?? 'unconfirmed') === 'unconfirmed').length, dot: 'bg-amber-500' },
          { key: 'incomplete' as const, label: 'Incompletas', count: sessions.filter((s) => isRecordingSessionIncomplete(s)).length, dot: 'bg-rose-500' },
        ]).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterConfirmation(f.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
              filterConfirmation === f.key
                ? 'border-border bg-muted text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-muted/60',
            )}
          >
            {f.dot && <span className={cn('h-1.5 w-1.5 rounded-full', f.dot)} aria-hidden />}
            {f.label}
            <span className="tabular-nums text-muted-foreground/70">{f.count}</span>
          </button>
        ))}
      </div>

      {conflicts.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Conflicto de disponibilidad</span>
          {conflicts.map((conflict) => (
            <span key={`${conflict.videographerId}-${conflict.date}`} className="inline-flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>
                {conflict.videographerName} · {conflict.sessionIds.length} sesiones el{' '}
                {format(parseISO(conflict.date), 'd MMM', { locale: es })}
              </span>
              {canAssign && (
                <Select onValueChange={(id) => handleAvailabilityPick(conflict.sessionIds[conflict.sessionIds.length - 1], id)}>
                  <SelectTrigger aria-label="Quién está disponible" className="h-7 w-[160px] text-[11px]">
                    <SelectValue placeholder="Quién está disponible" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Month navigation stays separate from filters for quick scanning. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <div><h2 className="text-xl font-semibold capitalize">{format(currentMonth, 'MMMM yyyy', { locale: es })}</h2><p className="mt-1 text-xs text-muted-foreground">{compact ? 'Tu agenda, día por día' : 'Color por videógrafo · Abre una sesión para ver su call sheet'}</p></div>
        <div className="flex items-center gap-1 rounded-xl border border-border p-1">
          <button aria-label="Mes Anterior" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <button aria-label="Volver A Hoy" onClick={() => setCurrentMonth(new Date())} className="h-10 rounded-lg px-4 text-sm font-medium hover:bg-muted">Hoy</button>
          <button aria-label="Mes Siguiente" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {view === 'map' ? <RecordingMap sessions={monthSessions.map(s=>({...s,title:sessionChipClientLabel(s,clients)}))} onOpen={id=>setIdeasSession(sessions.find(s=>s.id===id))}/> : view === 'calendar' && !compact ? (
        <div className="space-y-3">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 text-center">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="text-[10px] font-semibold text-muted-foreground pb-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2">
            {paddedDays.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />
              const daySessions = sessionsForDay(day)
              const dateStr = format(day, 'yyyy-MM-dd')
              const isCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <div
                  key={dateStr}
                  className={cn(
                    'group min-w-0 min-h-[120px] cursor-pointer rounded-xl border p-2 transition-colors xl:min-h-[140px]',
                    isToday(day) ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/70 bg-background/40 hover:border-sky-500/40',
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
                    {(expandedDays.includes(dateStr) ? daySessions : daySessions.slice(0, 3)).map((session) => {
                      const a = userAccent(session.videographer_id)
                      const clientLabel = sessionChipClientLabel(session, clients)
                      return (
                        <button
                          type="button"
                          key={session.id}
                          className="w-full text-left min-h-[52px] cursor-pointer rounded-lg px-2 py-2 text-[10px] leading-tight transition hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                          title={`${clientLabel} · ${session.start_time?.slice(0,5) || 'Hora Por Confirmar'} · Editor: ${editorFor(session)} · Videógrafo: ${session.videographer?.full_name || 'Sin Asignar'}`}
                          style={{ backgroundColor: a.soft, boxShadow: `inset 2px 0 0 0 ${a.dot}` }}
                          onClick={(e) => { e.stopPropagation(); setIdeasSession(session) }}
                        >
                          <span className="mb-1 flex items-center justify-between gap-1 text-[10px] font-medium tabular-nums text-muted-foreground"><span>{session.start_time?.slice(0,5) || 'Sin Hora'}</span>{(!session.videographer_id || !session.client_id || !clients.find(c=>c.id===session.client_id)?.assigned_to) && <span aria-label="Asignación Pendiente" title="Asignación Pendiente · Abre La Sesión" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}</span>
                          <p
                            data-slot="session-chip-client"
                            className="min-h-[14px] line-clamp-2 break-words text-xs font-semibold tracking-tight leading-snug text-foreground"
                          >
                            {clientLabel}
                          </p>
                        </button>
                      )
                    })}
                    {daySessions.length > 3 && (
                      <button type="button" className="min-h-9 w-full rounded-md text-xs font-medium text-sky-500 hover:bg-sky-500/10" onClick={e=>{e.stopPropagation();setExpandedDays(days=>days.includes(dateStr)?days.filter(d=>d!==dateStr):[...days,dateStr])}}>{expandedDays.includes(dateStr)?'Ver Menos':`Ver ${daySessions.length - 3} Más`}</button>
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
                    <span className="text-xs text-muted-foreground">{daySessions.length} {daySessions.length !== 1 ? 'sesiones' : 'sesión'}</span>
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
                          onConfirmationChange={(status) => handleConfirmationChange(session.id, status)}
                          onDelete={() => handleDelete(session.id)}
                          onOpenIdeas={() => setIdeasSession(session)}
                          ideaCount={sessionIdeaCount}
                          editorName={editorFor(session)}
                        />
                      )
                    })}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* key fuerza un montaje nuevo al cambiar de objetivo. Todos los campos
          del diálogo se inicializan con useState, que solo lee el valor la
          primera vez: sin esto, pulsar otro día del calendario no cambiaba la
          fecha, y abrir una segunda sesión mostraba los datos de la anterior. */}
      <SessionDialog
        key={editing?.id ?? addDate ?? 'nueva'}
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
          key={ideasSession.id}
          open={!!ideasSession}
          onClose={() => setIdeasSession(undefined)}
          session={ideasSession}
          editorName={editorFor(ideasSession)}
          onDelete={() => { const id = ideasSession.id; setIdeasSession(undefined); handleDelete(id) }}
          clientIdeas={ideasSession.client_id ? (ideasMap[ideasSession.client_id] ?? []) : []}
          teamMembers={teamMembers}
          onSessionChange={handleSaved}
          onEdit={() => {
            setIdeasSession(undefined)
            setEditing(ideasSession)
            setShowAdd(true)
          }}
          onIdeasChange={(updated) => {
            if (!ideasSession.client_id) return
            setIdeasMap((prev) => ({ ...prev, [ideasSession.client_id!]: updated }))
          }}
        />
      )}
    </div>
  )
}
