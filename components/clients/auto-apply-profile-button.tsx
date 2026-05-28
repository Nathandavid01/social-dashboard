'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, Check, X } from 'lucide-react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/lib/hooks/use-toast'
import { applyInferredProfileToAll, type AutoApplyResult } from '@/lib/actions/cadence'
import { dayLabelsShort } from '@/lib/utils/posting-cadence'
import { cn } from '@/lib/utils'

export function AutoApplyProfileButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [results, setResults] = useState<AutoApplyResult[] | null>(null)
  const { toast } = useToast()

  function run() {
    startTransition(async () => {
      const res = await applyInferredProfileToAll()
      setResults(res)
      const applied = res.filter((r) => r.applied).length
      toast({
        title: applied > 0 ? `${applied} clientes actualizados` : 'Sin cambios',
        description: `Procesados ${res.length} clientes activos.`,
      })
    })
  }

  const applied = results?.filter((r) => r.applied) ?? []
  const skipped = results?.filter((r) => !r.applied) ?? []

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setResults(null) }}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="transition-transform hover:scale-105">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Auto-aplicar a todos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Auto-rellenar perfiles desde Metricool
          </DialogTitle>
          <DialogDescription>
            Para cada cliente activo con blog en Metricool, infiere los días de publicación,
            la hora típica y las plataformas activas en los últimos 56 días y actualiza el perfil.
            Esto sobrescribe los valores actuales solo si son distintos.
          </DialogDescription>
        </DialogHeader>

        {!results && (
          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <p className="mb-2 font-medium">Esto actualizará por cliente:</p>
            <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
              <li>posting_days &mdash; días con ≥ 8% de los posts</li>
              <li>posting_time &mdash; hora más frecuente en buckets de 30 min</li>
              <li>default_platforms &mdash; redes con ≥ 20% del volumen</li>
            </ul>
          </div>
        )}

        {results && (
          <div className="space-y-3">
            <div className="flex gap-2 text-xs">
              <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-1 font-medium text-green-500">
                {applied.length} actualizados
              </span>
              <span className="rounded-full border bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                {skipped.length} sin cambio
              </span>
            </div>

            <ScrollArea className="max-h-[400px] rounded-md border">
              <ul className="divide-y">
                {results.map((r, i) => (
                  <li
                    key={r.clientId}
                    className={cn(
                      'flex flex-wrap items-start justify-between gap-2 p-3 text-sm animate-in fade-in slide-in-from-left-1 duration-300',
                      r.applied ? 'bg-green-500/[0.04]' : '',
                    )}
                    style={{ animationDelay: `${Math.min(i * 15, 400)}ms`, animationFillMode: 'backwards' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-medium">
                        {r.applied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="truncate">{r.clientName}</span>
                      </p>
                      {r.applied && r.changes && (
                        <div className="mt-1 space-y-0.5 pl-5 text-xs text-muted-foreground">
                          {r.changes.posting_days && (
                            <p>
                              <strong className="text-foreground">Días:</strong>{' '}
                              {r.changes.posting_days.from.length === 0 ? '∅' : r.changes.posting_days.from.map((d) => dayLabelsShort[d]).join(', ')}
                              {' → '}
                              <span className="text-green-500">{r.changes.posting_days.to.map((d) => dayLabelsShort[d]).join(', ')}</span>
                            </p>
                          )}
                          {r.changes.posting_time && (
                            <p>
                              <strong className="text-foreground">Hora:</strong>{' '}
                              {r.changes.posting_time.from ?? '∅'}
                              {' → '}
                              <span className="text-green-500">{r.changes.posting_time.to}</span>
                            </p>
                          )}
                          {r.changes.default_platforms && (
                            <p>
                              <strong className="text-foreground">Plataformas:</strong>{' '}
                              {r.changes.default_platforms.from.length === 0 ? '∅' : r.changes.default_platforms.from.join(', ')}
                              {' → '}
                              <span className="text-green-500">{r.changes.default_platforms.to.join(', ')}</span>
                            </p>
                          )}
                        </div>
                      )}
                      {!r.applied && r.reason && (
                        <p className="pl-5 text-xs text-muted-foreground">{r.reason}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {!results && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
              <Button onClick={run} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
                Aplicar a todos
              </Button>
            </>
          )}
          {results && (
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
