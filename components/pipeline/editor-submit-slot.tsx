'use client'

import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SubmitVideoCard } from './submit-video-card'
import { useSubmitVideos } from './use-submit-videos'
import { etiquetaDia, diaDePublicacion, fechaDeEntrega, type DiaKey } from '@/lib/entregas/dias'

/** '11 ago' — con el día solo no se distingue una semana de la siguiente. */
function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

/**
 * The real Editado column slot: the submit form plus per-video progress while
 * the batch uploads. Sits in the board so the editor never leaves the page.
 */

const STAGE_LABEL: Record<string, string> = {
  creando: 'Creando…',
  subiendo: 'Subiendo',
  registrando: 'Registrando…',
  listo: 'Listo',
  error: 'Error',
}

export function EditorSubmitSlot({
  clients,
  dia,
  semanaOffset = 0,
}: {
  clients: { id: string; name: string }[]
  /** Día de la pestaña activa — para el que se entrega. */
  dia: DiaKey
  /** Cuánto adelantado va: 0 lo próximo, 1 la semana siguiente. */
  semanaOffset?: number
}) {
  const router = useRouter()
  // Refresh so the new cards appear in Revisión from real data, not local state.
  const { submit, rows, running, clear } = useSubmitVideos(dia, () => router.refresh(), semanaOffset)

  return (
    <div className="space-y-2">
      <p className="px-0.5 text-[11px] text-muted-foreground">
        {/* Con el nombre del día solo no se distingue una semana de la
            siguiente: "Martes" es igual de cierto para el 4 y para el 11. */}
        Entregando para{' '}
        <strong className="text-foreground">
          {etiquetaDia(diaDePublicacion(dia))} {fechaCorta(fechaDeEntrega(dia, undefined, semanaOffset))}
        </strong>
      </p>
      <SubmitVideoCard clients={clients} onSubmit={submit} pending={running} />

      {rows.length > 0 && (
        <ul className="space-y-1.5 rounded-xl border bg-card p-2.5">
          {rows.map((r, i) => (
            <li key={i} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span className="min-w-0 flex-1 truncate text-[11px]">{r.title}</span>
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] tabular-nums',
                    r.stage === 'error' && 'text-destructive',
                    r.stage === 'listo' && 'text-emerald-600 dark:text-emerald-400',
                    r.stage !== 'error' && r.stage !== 'listo' && 'text-muted-foreground',
                  )}
                >
                  {r.stage === 'listo' && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
                  {r.stage === 'error' && <AlertCircle className="h-3 w-3" aria-hidden="true" />}
                  {r.stage !== 'listo' && r.stage !== 'error' && (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  )}
                  {STAGE_LABEL[r.stage]}
                  {r.stage === 'subiendo' && ` ${r.pct}%`}
                </span>
              </div>

              {r.stage === 'subiendo' && (
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${r.pct}%` }} />
                </div>
              )}

              {r.error && <p className="text-[10px] text-destructive">{r.error}</p>}
            </li>
          ))}

          {!running && (
            <li>
              <button
                onClick={clear}
                className="w-full pt-1 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Ocultar
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
