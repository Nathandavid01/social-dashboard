'use client'

import { useState, useTransition } from 'react'
import { Video, Save, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { updateClientProfile } from '@/lib/actions/client-profile'
import { cn } from '@/lib/utils'

interface Props {
  clientId: string
  initialThreshold: number
  /** Recorded-but-not-published videos in buffer (grabada + producida). */
  accumulated: number
}

export function VideoThresholdCard({ clientId, initialThreshold, accumulated }: Props) {
  const [threshold, setThreshold] = useState(initialThreshold)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const dirty = threshold !== initialThreshold
  const deficit = Math.max(threshold - accumulated, 0)
  const belowLimit = threshold > 0 && accumulated < threshold
  const pct = threshold > 0 ? Math.min((accumulated / threshold) * 100, 100) : 0

  function save() {
    startTransition(async () => {
      const res = await updateClientProfile(clientId, { video_threshold: threshold })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: 'Límite de videos guardado' })
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="video_threshold" className="text-xs">Límite mínimo de videos en buffer</Label>
        <div className="flex gap-2">
          <Input
            id="video_threshold"
            type="number"
            min={0}
            max={500}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(0, parseInt(e.target.value || '0', 10)))}
            className="h-9 w-28"
          />
          {dirty && (
            <Button size="sm" onClick={save} disabled={isPending}>
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Guardar
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Videos grabados que el cliente debe tener acumulados. Si baja de aquí, se notifica al equipo.
        </p>
      </div>

      {/* Buffer status */}
      <div
        className={cn(
          'rounded-lg border p-3',
          threshold === 0
            ? 'border-border bg-muted/40'
            : belowLimit
              ? 'border-red-500/30 bg-red-500/5'
              : 'border-green-500/30 bg-green-500/5',
        )}
      >
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <Video className="h-4 w-4" /> En buffer
          </span>
          <span className="tabular-nums">
            <strong className={cn(belowLimit && 'text-red-500')}>{accumulated}</strong>
            {threshold > 0 && <span className="text-muted-foreground"> / {threshold}</span>}
          </span>
        </div>
        {threshold > 0 && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full transition-all duration-500', belowLimit ? 'bg-red-500' : 'bg-green-500')}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {threshold > 0 && belowLimit ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-500">
            <AlertTriangle className="h-3.5 w-3.5" /> Faltan grabar {deficit} video{deficit === 1 ? '' : 's'}
          </p>
        ) : threshold > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" /> Buffer completo
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Sin límite configurado.</p>
        )}
      </div>
    </div>
  )
}
