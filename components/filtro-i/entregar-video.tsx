'use client'

import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle, ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SubmitVideoCard } from '@/components/pipeline/submit-video-card'
import { useFiltroISubmit, type EtapaFiltroI } from './use-filtro-i-submit'

/**
 * El formulario de entrega de Filtro I, con el progreso de cada video.
 *
 * Reusa `SubmitVideoCard` (components/pipeline — el formulario compartido, no
 * una pantalla) y le pone detrás la cadena propia: frames, subida y análisis.
 */

const ETIQUETA: Record<EtapaFiltroI, string> = {
  frames: 'Leyendo el video',
  creando: 'Creando…',
  subiendo: 'Subiendo',
  registrando: 'Registrando…',
  analizando: 'Enviando a revisar',
  listo: 'Entregado',
  error: 'Error',
}

export function EntregarVideo({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter()
  // Refresca para que las tarjetas de análisis salgan de datos reales y no de
  // estado local que se pierde al navegar.
  const { submit, filas, corriendo } = useFiltroISubmit(() => router.refresh())

  return (
    <div className="space-y-2">
      <SubmitVideoCard clients={clients} onSubmit={submit} pending={corriendo} />

      {filas.length > 0 && (
        <ul className="space-y-1 rounded-xl border bg-card p-2.5">
          {filas.map((f, i) => (
            <li key={i} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span className="min-w-0 flex-1 truncate text-[11px]">{f.title}</span>
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] tabular-nums',
                    f.etapa === 'error' && 'text-destructive',
                    (f.etapa === 'listo' || f.etapa === 'analizando') &&
                      'text-emerald-600 dark:text-emerald-400',
                    f.etapa !== 'error' &&
                      f.etapa !== 'listo' &&
                      f.etapa !== 'analizando' &&
                      'text-muted-foreground',
                  )}
                >
                  {f.etapa === 'error' ? (
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  ) : f.etapa === 'listo' ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : f.etapa === 'analizando' ? (
                    <ScanLine className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  )}
                  {ETIQUETA[f.etapa]}
                  {f.etapa === 'subiendo' ? ` ${f.pct}%` : ''}
                </span>
              </div>
              {f.error && (
                <p className="break-words text-[10px] leading-snug text-destructive">{f.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
