'use client'

import { useState, useTransition } from 'react'
import { Loader2, SlidersHorizontal, ShieldCheck } from 'lucide-react'
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
import { setUserAreaAccess } from '@/lib/actions/users'
import { AREAS } from '@/lib/auth/areas'
import { cn } from '@/lib/utils'

export function AreaAccessDialog({
  userId,
  userName,
  currentAccess,
}: {
  userId: string
  userName: string
  /** null = no restriction (role defaults). Array = explicit allowed area hrefs. */
  currentAccess: string[] | null
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [restricted, setRestricted] = useState(currentAccess !== null)
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAccess ?? []))

  const isRestricted = currentAccess !== null

  function toggle(href: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  function save() {
    startTransition(async () => {
      const value = restricted ? Array.from(selected) : null
      const res = await setUserAreaAccess(userId, value)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      } else {
        toast({
          title: 'Acceso actualizado',
          description: restricted
            ? `${userName}: ${selected.size} área${selected.size === 1 ? '' : 's'} permitida${selected.size === 1 ? '' : 's'}.`
            : `${userName}: acceso completo según su rol.`,
        })
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 whitespace-nowrap"
          title="Configurar áreas a las que puede acceder"
        >
          <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
          {isRestricted ? `Áreas (${currentAccess!.length})` : 'Áreas'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Áreas de {userName}
          </DialogTitle>
          <DialogDescription>
            Define a qué secciones de la app puede entrar. El rol sigue controlando
            las acciones dentro de cada área.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input
              type="radio"
              name="access-mode"
              className="mt-1"
              checked={!restricted}
              onChange={() => setRestricted(false)}
            />
            <div>
              <p className="text-sm font-medium">Acceso completo (según el rol)</p>
              <p className="text-xs text-muted-foreground">Ve todas las áreas que su rol permite.</p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input
              type="radio"
              name="access-mode"
              className="mt-1"
              checked={restricted}
              onChange={() => setRestricted(true)}
            />
            <div>
              <p className="text-sm font-medium">Restringir a áreas específicas</p>
              <p className="text-xs text-muted-foreground">Solo podrá entrar a las áreas marcadas abajo.</p>
            </div>
          </label>

          {restricted && (
            <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border p-2">
              {AREAS.map((a) => {
                const checked = selected.has(a.href)
                return (
                  <label
                    key={a.href}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      checked ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(a.href)} />
                    <span className="truncate">{a.label}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={isPending || (restricted && selected.size === 0)}>
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
