'use client'

import { useState, useTransition } from 'react'
import { UserCheck, UserX, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { RoleSelector } from '@/components/team/role-selector'
import { AreaAccessDialog } from '@/components/team/area-access-dialog'
import { ResetPasswordDialog } from '@/components/team/reset-password-dialog'
import { CreateUserDialog } from '@/components/team/create-user-dialog'
import { updateUserProfile, setUserStatus } from '@/lib/actions/users'
import type { Profile, UserStatus } from '@/lib/supabase/types'

export function UserAdminTable({
  users,
  currentUserId,
}: {
  users: Profile[]
  currentUserId: string
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b p-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-base font-bold tracking-tight">Usuarios y permisos</h2>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
          </span>
        </div>
        <CreateUserDialog />
      </div>
      <div className="divide-y">
        {users.map((u) => (
          <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
        ))}
      </div>
    </section>
  )
}

function UserRow({ user, isSelf }: { user: Profile; isSelf: boolean }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(user.full_name ?? '')
  const [title, setTitle] = useState(user.title ?? '')
  const inactive = user.status === 'inactive'

  function saveProfile() {
    if (name.trim() === (user.full_name ?? '') && title.trim() === (user.title ?? '')) return
    startTransition(async () => {
      const res = await updateUserProfile(user.id, { full_name: name, title })
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        setName(user.full_name ?? '')
        setTitle(user.title ?? '')
      } else {
        toast({ title: 'Usuario actualizado' })
      }
    })
  }

  function toggleStatus() {
    const next: UserStatus = inactive ? 'active' : 'inactive'
    startTransition(async () => {
      const res = await setUserStatus(user.id, next)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: next === 'active' ? 'Usuario activado' : 'Usuario desactivado' })
    })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-3 p-3', inactive && 'opacity-60')}>
      <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveProfile}
          placeholder="Nombre"
          className="h-8 text-sm"
          aria-label={`Nombre de ${user.email}`}
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveProfile}
          placeholder="Título"
          className="h-8 text-sm"
          aria-label={`Título de ${user.email}`}
        />
      </div>
      <span className="min-w-0 shrink-0 truncate text-xs text-muted-foreground sm:w-44">{user.email}</span>
      <div className="flex shrink-0 items-center gap-2">
        <RoleSelector userId={user.id} userName={user.full_name ?? user.email} currentRole={user.role} />
        <AreaAccessDialog
          userId={user.id}
          userName={user.full_name ?? user.email}
          currentAccess={user.area_access ?? null}
          role={user.role}
        />
        <ResetPasswordDialog userId={user.id} userName={user.full_name ?? user.email} />
        <Button
          size="sm"
          variant={inactive ? 'outline' : 'ghost'}
          onClick={toggleStatus}
          disabled={isPending || isSelf}
          title={isSelf ? 'No puedes cambiar tu propio estado' : undefined}
          className={cn('h-8 whitespace-nowrap', inactive ? 'text-muted-foreground' : 'text-emerald-600')}
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : inactive ? (
            <UserX className="mr-1 h-3.5 w-3.5" />
          ) : (
            <UserCheck className="mr-1 h-3.5 w-3.5" />
          )}
          {inactive ? 'Inactivo' : 'Activo'}
        </Button>
      </div>
    </div>
  )
}
