'use client'

import { useState, useTransition } from 'react'
import { BellRing, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/lib/hooks/use-toast'
import { saveNotificationPreferences } from '@/lib/actions/notification-preferences'
import { cn } from '@/lib/utils'

interface Props {
  initialEnabled: boolean
}

export function ClientReviewToastToggle({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function toggle() {
    const next = !enabled
    setEnabled(next)
    startTransition(async () => {
      const res = await saveNotificationPreferences({ client_review_toast: next })
      if (res.error) {
        setEnabled(!next)
        toast({ title: 'No Se Pudo Guardar', description: res.error, variant: 'destructive' })
        return
      }
      toast({
        title: next ? 'Avisos Emergentes Activados' : 'Avisos Emergentes Desactivados',
        description: next
          ? 'Verás un aviso arriba a la derecha cuando un cliente vote en /aprobacion.'
          : 'Los votos del cliente se siguen guardando; solo se oculta el aviso emergente.',
      })
    })
  }

  return (
    <Card
      className={cn(
        'border-2 transition-colors',
        enabled ? 'border-sky-500/40 bg-sky-500/[0.04]' : 'border-muted bg-muted/30',
      )}
    >
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg',
              enabled ? 'bg-sky-500/15 text-sky-500' : 'bg-muted text-muted-foreground',
            )}
          >
            <BellRing className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold">Avisos emergentes de revisión del cliente</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Muestra un aviso arriba a la derecha cuando un cliente aprueba o pide cambios en
              /aprobacion. No cambia el guardado de los votos.
            </p>
          </div>
        </div>
        <Button
          variant={enabled ? 'outline' : 'default'}
          size="sm"
          disabled={isPending}
          onClick={toggle}
          aria-pressed={enabled}
        >
          {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {enabled ? 'Desactivar' : 'Activar'}
        </Button>
      </CardContent>
    </Card>
  )
}
