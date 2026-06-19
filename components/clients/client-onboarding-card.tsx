'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Check, Circle, Sparkles, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { activateClient } from '@/lib/actions/clients'
import type { OnboardingStatus, OnboardingKey } from '@/lib/utils/client-onboarding'

/** Deep-link (or one-click action) to fix each pending item. */
function actionFor(key: OnboardingKey, clientId: string): { label: string; href?: string } {
  switch (key) {
    case 'metricool':
      return { label: 'Conectar', href: `/clients/${clientId}/edit` }
    case 'cadence':
      return { label: 'Definir días', href: `/clients/${clientId}?tab=schedule` }
    case 'voice':
      return { label: 'Agregar', href: `/clients/${clientId}?tab=brand` }
    case 'firstVideo':
      return { label: 'Crear lote', href: `/clients/${clientId}/batch` }
    default:
      return { label: 'Activar' } // handled as a one-click button
  }
}

/**
 * "Listo para automatizar" — a live onboarding checklist on the client profile.
 * Shows only while setup is incomplete; each pending item links straight to
 * where to fix it (or, for status, activates in one click).
 */
export function ClientOnboardingCard({ clientId, status }: { clientId: string; status: OnboardingStatus }) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  if (status.complete) return null

  function activate() {
    startTransition(async () => {
      const res = await activateClient(clientId)
      if (res?.error) toast({ title: 'No se pudo activar', description: res.error, variant: 'destructive' })
      else toast({ title: 'Cliente activado', description: 'El contenido ya puede planificarse y publicarse solo.' })
    })
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.04] animate-in fade-in duration-500">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" /> Listo para automatizar
        </CardTitle>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
          {status.doneCount}/{status.total}
        </span>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {!status.automatable && (
          <p className="mb-1.5 text-xs text-muted-foreground">
            Completa lo esencial y el contenido empieza a fluir solo (lote, captions y publicación).
          </p>
        )}
        <ul className="space-y-1">
          {status.items.map((item) => {
            const action = actionFor(item.key, clientId)
            return (
              <li
                key={item.key}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2 py-1.5',
                  item.done ? 'opacity-60' : 'bg-muted/40',
                )}
              >
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-full',
                    item.done ? 'bg-emerald-500/15 text-emerald-500' : 'border border-border text-muted-foreground',
                  )}
                >
                  {item.done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2 fill-current" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', item.done && 'line-through')}>
                    {item.label}
                    {!item.required && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">opcional</span>}
                  </p>
                  {!item.done && <p className="text-[11px] leading-snug text-muted-foreground">{item.hint}</p>}
                </div>
                {!item.done &&
                  (item.key === 'active' ? (
                    <Button size="sm" className="h-7 shrink-0 px-2.5 text-xs" disabled={pending} onClick={activate}>
                      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Activar'}
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2.5 text-xs">
                      <Link href={action.href!}>
                        {action.label} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  ))}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
