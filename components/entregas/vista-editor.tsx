'use client'

import { useRouter } from 'next/navigation'
import { RotateCcw, PackageCheck } from 'lucide-react'
import { EditorSubmitSlot } from '@/components/pipeline/editor-submit-slot'
import type { ReviewNote } from '@/lib/actions/review-notes-core'

/**
 * Lo que ve un editor al abrir Revisión: entregar, y qué le devolvieron.
 *
 * Sin pestañas de día ni selector de semana. Esas existen para repartir el
 * trabajo del equipo, y el editor no reparte nada: sube su video con su fecha y
 * ya. La fecha la dice él video a video, así que la pestaña tampoco decidía
 * nada.
 *
 * Los devueltos siguen aquí porque son lo único que le pide acción. Sin esto
 * reenviaría el mismo video sin saber qué corregir.
 */

export interface VideoDevuelto {
  id: string
  titulo: string
  clientName: string
  nota: ReviewNote | null
}

export function VistaEditor({
  submitClients,
  devueltos,
}: {
  submitClients: { id: string; name: string }[]
  devueltos: VideoDevuelto[]
}) {
  const router = useRouter()

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-4">
      <header className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-amber-600 text-black">
          <PackageCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-tight">Entregar videos</h1>
          <p className="truncate text-xs text-muted-foreground">
            Sube el video y dinos para cuándo es.
          </p>
        </div>
      </header>

      {/* `dia` ya no decide nada — cada video lleva su fecha —, pero el slot
          sigue pidiéndolo por firma. */}
      <EditorSubmitSlot clients={submitClients} dia={1} />

      {devueltos.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <RotateCcw className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
            Te devolvieron {devueltos.length}
          </h2>
          <ul className="space-y-2">
            {devueltos.map((v) => (
              <li key={v.id} className="space-y-1.5 rounded-xl border border-rose-500/25 bg-rose-500/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                  <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{v.titulo}</p>
                  <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                    {v.clientName}
                  </span>
                </div>
                {v.nota ? (
                  <>
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                      Cambios pedidos{v.nota.author ? ` · ${v.nota.author}` : ''}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-[12px] leading-snug">
                      {v.nota.note}
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] text-muted-foreground">
                    Sin detalle. Pregúntale a quien lo revisó qué hay que cambiar.
                  </p>
                )}
                <button
                  onClick={() => router.refresh()}
                  className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                >
                  Vuelve a subirlo arriba cuando lo tengas
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
