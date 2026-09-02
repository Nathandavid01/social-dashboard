'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { MoreVertical, Pencil, Loader2, UserCheck, UserX, Search, SlidersHorizontal, ChevronDown, Camera, ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { RoleSelector } from '@/components/team/role-selector'
import { AreaAccessPanel } from '@/components/team/area-access-inline'
import { ResetPasswordDialog } from '@/components/team/reset-password-dialog'
import { CreateUserDialog } from '@/components/team/create-user-dialog'
import { updateUserProfile, setUserStatus, setUserAvatar, removeUserAvatar } from '@/lib/actions/users'
import { initialsFrom, validateAvatarFile } from '@/lib/utils/avatar-core'
import { normalizeAreaAccess } from '@/lib/auth/areas'
import type { Profile, UserRole, UserStatus } from '@/lib/supabase/types'

// Role filter chips. Mirrors the segmented control in the design; the three
// concrete roles plus "Todos". Users with other roles (video, legacy) still
// show under "Todos".
const SEGMENTS: { key: string; label: string; match: (r: UserRole) => boolean }[] = [
  { key: 'all', label: 'Todos', match: () => true },
  { key: 'owner', label: 'Owners', match: (r) => r === 'owner' },
  { key: 'supervisor', label: 'Supervisores', match: (r) => r === 'supervisor' },
  { key: 'editor', label: 'Editores', match: (r) => r === 'editor' },
]

// Avatar ring/tint per role — keeps the same colour language as RoleSelector.
const ROLE_AVATAR: Record<UserRole, string> = {
  owner: 'text-yellow-500 border-yellow-500/40 bg-yellow-500/10',
  supervisor: 'text-purple-500 border-purple-500/40 bg-purple-500/10',
  editor: 'text-blue-500 border-blue-500/40 bg-blue-500/10',
  video: 'text-cyan-500 border-cyan-500/40 bg-cyan-500/10',
  disenador: 'text-pink-500 border-pink-500/40 bg-pink-500/10',
  copy: 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10',
  team_member: 'text-muted-foreground border-border bg-muted',
}

export function UserAdminTable({
  users,
  currentUserId,
  canEditPhotos = false,
}: {
  users: Profile[]
  currentUserId: string
  /** Solo owners: poner o quitar la foto de otra persona desde su avatar. */
  canEditPhotos?: boolean
}) {
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const seg = SEGMENTS.find((s) => s.key === segment) ?? SEGMENTS[0]
    return users.filter(
      (u) =>
        seg.match(u.role) &&
        (q === '' ||
          (u.full_name ?? '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)),
    )
  }, [users, query, segment])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          {`${users.length} ${users.length === 1 ? 'persona' : 'personas'}`}
        </p>
        <CreateUserDialog />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar persona…"
            aria-label="Buscar persona"
            className="h-9 pl-9"
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSegment(s.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                segment === s.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No encontramos personas con ese filtro.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <UserCard key={u.id} user={u} isSelf={u.id === currentUserId} canEditPhoto={canEditPhotos} />
          ))}
        </div>
      )}
    </section>
  )
}

function UserCard({ user, isSelf, canEditPhoto }: { user: Profile; isSelf: boolean; canEditPhoto: boolean }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [areasOpen, setAreasOpen] = useState(false)
  const inactive = user.status === 'inactive'
  const displayName = user.full_name?.trim() || user.email
  const areaGrant = normalizeAreaAccess(user.area_access ?? null)

  function toggleStatus() {
    const next: UserStatus = inactive ? 'active' : 'inactive'
    startTransition(async () => {
      const res = await setUserStatus(user.id, next)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: next === 'active' ? 'Usuario activado' : 'Usuario desactivado' })
    })
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-colors hover:border-border/80',
        inactive && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-3 p-3">
      <UserPhoto user={user} displayName={displayName} editable={canEditPhoto} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {user.full_name || 'Sin nombre'}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {user.email}
          {user.title ? ` · ${user.title}` : ''}
        </p>
      </div>

      <RoleSelector userId={user.id} userName={displayName} currentRole={user.role} />
      <Button
        size="sm"
        variant="ghost"
        className="h-8 whitespace-nowrap"
        aria-expanded={areasOpen}
        onClick={() => setAreasOpen((o) => !o)}
        title="Configurar áreas a las que puede acceder"
      >
        <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', areaGrant ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600')}>
          {areaGrant ? `${areaGrant.length} ${areaGrant.length === 1 ? 'área' : 'áreas'}` : 'Acceso completo'}
        </span>
        <ChevronDown className={cn('ml-1 h-3.5 w-3.5 transition-transform', areasOpen && 'rotate-180')} />
      </Button>
      <ResetPasswordDialog userId={user.id} userName={displayName} />

      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
          inactive
            ? 'border-border bg-muted text-muted-foreground'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', inactive ? 'bg-muted-foreground' : 'bg-emerald-500')} />
        {inactive ? 'Inactivo' : 'Activo'}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            aria-label={`Acciones de ${displayName}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar nombre y título
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf || isPending}
            onSelect={(e) => {
              e.preventDefault()
              if (!isSelf) toggleStatus()
            }}
            className={cn(!isSelf && (inactive ? 'text-emerald-600' : 'text-destructive'))}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : inactive ? (
              <UserCheck className="mr-2 h-4 w-4" />
            ) : (
              <UserX className="mr-2 h-4 w-4" />
            )}
            {inactive ? 'Activar usuario' : 'Desactivar usuario'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProfileDialog user={user} open={editOpen} onOpenChange={setEditOpen} />
      </div>
      {areasOpen && (
        <div className="border-t p-3">
          <AreaAccessPanel
            userId={user.id}
            userName={displayName}
            currentAccess={user.area_access ?? null}
            role={user.role}
            onClose={() => setAreasOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

function EditProfileDialog({
  user,
  open,
  onOpenChange,
}: {
  user: Profile
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(user.full_name ?? '')
  const [title, setTitle] = useState(user.title ?? '')
  // '' = no ceiling (distinct from '0', which means "take nothing today").
  const [capacity, setCapacity] = useState(
    user.daily_video_capacity === null || user.daily_video_capacity === undefined
      ? ''
      : String(user.daily_video_capacity),
  )
  const [isPending, startTransition] = useTransition()

  function save() {
    const raw = capacity.trim()
    startTransition(async () => {
      const res = await updateUserProfile(user.id, {
        full_name: name,
        title,
        daily_video_capacity: raw === '' ? null : Number(raw),
      })
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: 'Usuario actualizado' })
        onOpenChange(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>Actualiza los datos de {user.email}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Nombre
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" placeholder="Nombre" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Título
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9"
              placeholder="Título (opcional)"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Videos por día que aguanta
            <Input
              type="number"
              min={0}
              max={50}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="h-9"
              placeholder="Sin tope"
            />
            <span>
              En blanco = sin tope. Se usa en “Mi día” para avisarle cuando está sobrecargado.
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Avatar de la tarjeta: la foto real si existe (antes se pedía `avatar_url` y
 * se pintaban iniciales igual), iniciales teñidas por rol si no. Para un owner
 * es un botón: subir una foto nueva o quitarla, sin salir de la lista.
 */
function UserPhoto({ user, displayName, editable }: { user: Profile; displayName: string; editable: boolean }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  // La foto nueva llega por revalidación del servidor; mientras, el spinner.
  const src = user.avatar_url ?? null

  const circle = (
    <span
      className={cn(
        'relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border text-sm font-bold',
        ROLE_AVATAR[user.role],
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Foto de ${displayName}`} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initialsFrom(displayName)}</span>
      )}
      {isPending && (
        <span className="absolute inset-0 grid place-items-center bg-background/70">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      )}
    </span>
  )

  if (!editable) return circle

  function onPick(file: File | null) {
    const valid = validateAvatarFile(file)
    if (!valid.ok) {
      toast({ title: 'No se pudo usar esa imagen', description: valid.error, variant: 'destructive' })
      return
    }
    const fd = new FormData()
    fd.set('file', valid.file)
    startTransition(async () => {
      const res = await setUserAvatar(user.id, fd)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: 'Foto actualizada', description: `${displayName} ya tiene su foto de perfil.` })
      }
    })
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeUserAvatar(user.id)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: 'Foto quitada', description: `${displayName} vuelve a sus iniciales.` })
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group relative shrink-0 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Cambiar foto de ${displayName}`}
          title="Cambiar foto"
          disabled={isPending}
        >
          {circle}
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors group-hover:text-foreground">
            <Camera className="h-3 w-3" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
          <ImagePlus className="mr-2 h-4 w-4" />
          {src ? 'Cambiar foto' : 'Subir foto'}
        </DropdownMenuItem>
        {src && (
          <DropdownMenuItem onSelect={onRemove} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Quitar foto
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Archivo de foto de ${displayName}`}
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
    </DropdownMenu>
  )
}
