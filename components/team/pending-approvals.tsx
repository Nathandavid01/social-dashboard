'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, UserCheck, UserX, Crown, UserCog, Pencil, Video, Shield, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { approveUser, rejectUser } from '@/lib/actions/approvals'
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils'
import type { Profile, UserRole } from '@/lib/supabase/types'

const ROLE_ICON: Record<UserRole, typeof Crown> = {
  owner: Crown,
  supervisor: UserCog,
  editor: Pencil,
  video: Video,
  team_member: Shield,
}

const ROLE_TONE: Record<UserRole, string> = {
  owner: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
  supervisor: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  editor: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  video: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
  team_member: 'text-muted-foreground bg-muted border-border',
}

export function PendingApprovals({ pending }: { pending: Profile[] }) {
  if (pending.length === 0) {
    return (
      <section className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-bold tracking-tight">Solicitudes de acceso</h2>
        </div>
        <p className="p-6 text-center text-sm text-muted-foreground">
          No hay cuentas pendientes de aprobación.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-amber-500/30 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-amber-500/20 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-amber-500" />
          <h2 className="text-base font-bold tracking-tight">Solicitudes de acceso</h2>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
          {pending.length} pendiente{pending.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="divide-y">
        {pending.map((u) => (
          <PendingRow key={u.id} user={u} />
        ))}
      </div>
    </section>
  )
}

function PendingRow({ user }: { user: Profile }) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<UserRole>('editor')

  function approve() {
    startTransition(async () => {
      const res = await approveUser(user.id, picked)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: 'Usuario aprobado', description: `${user.full_name || user.email} ahora es ${ROLE_LABEL[picked]}.` })
        setOpen(false)
      }
    })
  }

  function reject() {
    startTransition(async () => {
      const res = await rejectUser(user.id)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: 'Solicitud rechazada', description: `${user.full_name || user.email} no tendrá acceso.` })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.full_name || 'Sin nombre'}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 whitespace-nowrap" disabled={isPending}>
              <UserCheck className="mr-1 h-3.5 w-3.5" />
              Aprobar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Aprobar a {user.full_name || user.email}
              </DialogTitle>
              <DialogDescription>
                Elige el rol con el que entrará al dashboard. Podrás cambiarlo después.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              {ASSIGNABLE_ROLES.map((r) => {
                const RIcon = ROLE_ICON[r]
                const active = picked === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPicked(r)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all',
                      active ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/40',
                    )}
                  >
                    <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-md', ROLE_TONE[r])}>
                      <RIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{ROLE_LABEL[r]}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[r]}</p>
                    </div>
                    {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                )
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={approve} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Aprobar como {ROLE_LABEL[picked]}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          size="sm"
          variant="ghost"
          onClick={reject}
          disabled={isPending}
          className="h-8 whitespace-nowrap text-destructive hover:text-destructive"
        >
          <UserX className="mr-1 h-3.5 w-3.5" />
          Rechazar
        </Button>
      </div>
    </div>
  )
}
