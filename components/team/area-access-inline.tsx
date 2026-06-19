'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { setUserAreaAccess } from '@/lib/actions/users'
import { AREAS, effectiveAreaHrefs, normalizeAreaAccess } from '@/lib/auth/areas'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/supabase/types'

/**
 * Area-access editor rendered in a collapsible panel below a user card
 * (instead of a modal). Full access (role defaults) vs an explicit per-area
 * grant; saves via setUserAreaAccess.
 */
export function AreaAccessPanel({
  userId,
  userName,
  currentAccess,
  role,
  onClose,
}: {
  userId: string
  userName: string
  /** null = no restriction (role defaults). Array = explicit allowed area hrefs. */
  currentAccess: string[] | null
  role: UserRole | null
  onClose?: () => void
}) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const normalized = normalizeAreaAccess(currentAccess)
  const isRestricted = normalized !== null
  // Pre-fill with what the user can reach today: their stored grant when
  // restricted, or their current role-based areas when unrestricted.
  const baseline = normalized ?? Array.from(effectiveAreaHrefs(role, null))

  const [restricted, setRestricted] = useState(isRestricted)
  const [selected, setSelected] = useState<Set<string>>(new Set(baseline))

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
        onClose?.()
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Define a qué secciones puede entrar {userName}. El rol sigue controlando las acciones dentro de
        cada área.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5">
          <input
            type="radio"
            name={`access-${userId}`}
            className="mt-0.5"
            checked={!restricted}
            onChange={() => setRestricted(false)}
          />
          <div>
            <p className="text-sm font-medium">Acceso completo (según el rol)</p>
            <p className="text-xs text-muted-foreground">Ve todas las áreas que su rol permite.</p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5">
          <input
            type="radio"
            name={`access-${userId}`}
            className="mt-0.5"
            checked={restricted}
            onChange={() => setRestricted(true)}
          />
          <div>
            <p className="text-sm font-medium">Restringir a áreas específicas</p>
            <p className="text-xs text-muted-foreground">Solo podrá entrar a las áreas marcadas.</p>
          </div>
        </label>
      </div>

      {restricted && (
        <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border p-2 sm:grid-cols-3">
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

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onClose?.()} disabled={isPending}>
          Cancelar
        </Button>
        <Button size="sm" onClick={save} disabled={isPending || (restricted && selected.size === 0)}>
          {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Guardar
        </Button>
      </div>
    </div>
  )
}
