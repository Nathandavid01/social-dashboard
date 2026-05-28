'use client'

import { useState, useTransition } from 'react'
import { Shield, Loader2, Check, Crown, UserCog, Pencil, Video } from 'lucide-react'
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
import { changeUserRole } from '@/lib/actions/team-roles'
import { useAuth } from '@/lib/context/auth-context'
import { hasPermission, ASSIGNABLE_ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/supabase/types'

interface Props {
  userId: string
  userName: string
  currentRole: UserRole | null
}

const ROLE_ICON: Record<UserRole, typeof Crown> = {
  owner:       Crown,
  supervisor:  UserCog,
  editor:      Pencil,
  video:       Video,
  team_member: Shield,
}

const ROLE_TONE: Record<UserRole, string> = {
  owner:       'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
  supervisor:  'text-purple-500 bg-purple-500/10 border-purple-500/30',
  editor:      'text-blue-500 bg-blue-500/10 border-blue-500/30',
  video:       'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
  team_member: 'text-muted-foreground bg-muted border-border',
}

export function RoleSelector({ userId, userName, currentRole }: Props) {
  const { role: viewerRole } = useAuth()
  const canEdit = hasPermission(viewerRole, 'team.assign_roles')

  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<UserRole>((currentRole as UserRole) ?? 'editor')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const Icon = ROLE_ICON[(currentRole as UserRole) ?? 'editor'] ?? Shield
  const tone = ROLE_TONE[(currentRole as UserRole) ?? 'editor']
  const label = currentRole ? ROLE_LABEL[currentRole as UserRole] : 'Sin rol'

  function save() {
    startTransition(async () => {
      const res = await changeUserRole(userId, picked)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: 'Rol actualizado', description: `${userName} ahora es ${ROLE_LABEL[picked]}` })
        setOpen(false)
      }
    })
  }

  const pill = (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', tone)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )

  if (!canEdit) return pill

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all hover:scale-105',
            tone,
          )}
          aria-label={`Cambiar rol de ${userName}`}
        >
          <Icon className="h-3 w-3" />
          {label}
          <Pencil className="h-2.5 w-2.5 opacity-50" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Cambiar rol de {userName}
          </DialogTitle>
          <DialogDescription>
            El rol controla qué secciones y acciones tiene disponibles. Solo los Owners pueden cambiarlo.
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
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={save} disabled={isPending || picked === currentRole}>
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
