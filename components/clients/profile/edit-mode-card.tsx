'use client'

import { useState, useTransition } from 'react'
import { Bot, UserRound, Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/hooks/use-toast'
import { updateClientProfile } from '@/lib/actions/client-profile'
import { cn } from '@/lib/utils'
import type { ClientEditMode } from '@/lib/supabase/types'

const OPTIONS: { value: ClientEditMode; label: string; hint: string; icon: typeof Bot }[] = [
  { value: 'human', label: 'Editor humano', hint: 'El editor baja crudos y sube el corte a mano.', icon: UserRound },
  { value: 'ai', label: 'AI', hint: 'Flag para pipeline AI. El auto-dispatch completo aún no está activo.', icon: Bot },
]

export function EditModeCard({
  clientId,
  initialMode = 'human',
}: {
  clientId: string
  initialMode?: ClientEditMode | null
}) {
  const [mode, setMode] = useState<ClientEditMode>(initialMode === 'ai' ? 'ai' : 'human')
  const [pending, start] = useTransition()
  const { toast } = useToast()

  function choose(next: ClientEditMode) {
    if (next === mode || pending) return
    const prev = mode
    setMode(next)
    start(async () => {
      const res = await updateClientProfile(clientId, { edit_mode: next })
      if (res.error) {
        setMode(prev)
        toast({ title: 'No se pudo guardar', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: next === 'ai' ? 'Modo AI guardado' : 'Modo Editor humano guardado' })
      }
    })
  }

  return (
    <div className="space-y-2" data-testid="client-edit-mode">
      <Label className="text-xs">Quién edita los videos</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon
          const on = mode === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              aria-pressed={on}
              onClick={() => choose(opt.value)}
              className={cn(
                'flex min-h-14 items-start gap-2 rounded-lg border px-3 py-2 text-left transition',
                on ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40',
                pending && 'opacity-60',
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-[10px] text-muted-foreground">{opt.hint}</span>
              </span>
              {pending && on && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
