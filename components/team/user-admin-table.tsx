'use client'

import { useMemo, useState, useTransition } from 'react'
import { MoreVertical, Pencil, Loader2, UserCheck, UserX, Search, SlidersHorizontal, ChevronDown } from 'lucide-react'
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
import { updateUserProfile, setUserStatus } from '@/lib/actions/users'
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
  team_member: 'text-muted-foreground border-border bg-muted',
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const raw = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)
  return raw.toUpperCase()
}

export function UserAdminTable({
  users,
  currentUserId,
}: {
  users: Profile[]
  currentUserId: string
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
            <UserCard key={u.id} user={u} isSelf={u.id === currentUserId} />
          ))}
        </div>
      )}
    </section>
  )
}

function UserCard({ user, isSelf }: { user: Profile; isSelf: boolean }) {
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
      <div
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-full border text-sm font-bold',
          ROLE_AVATAR[user.role],
        )}
        aria-hidden
      >
        {initials(displayName)}
      </div>

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
        {areaGrant ? `Áreas (${areaGrant.length})` : 'Áreas'}
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
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await updateUserProfile(user.id, { full_name: name, title })
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
          <DialogDescription>Actualiza el nombre y el título de {user.email}.</DialogDescription>
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
