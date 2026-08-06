'use client'

import { useState } from 'react'
import { Sparkles, Copy, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnalisisGrokIng } from '@/lib/filtro-i/consultas'
import { vistaEditor } from '@/lib/filtro-i/estado-ui'

/**
 * Grok-ing — el caption que sale del análisis de Filtro I.
 *
 * Área aparte porque la ve gente distinta: el editor entrega el video y ve sus
 * errores en Filtro I; el caption es de quien lo trabaja. Por ahora solo lo
 * enseña y deja copiarlo — la integración con Copy viene después.
 */
export function GrokIngPanel({ analisis }: { analisis: AnalisisGrokIng[] }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-4">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-amber-600 text-black">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">Grok-ing</h1>
            <p className="truncate text-xs text-muted-foreground">
              El caption de cada video, escrito a partir de lo que dice de verdad.
            </p>
          </div>
        </div>
      </header>

      {analisis.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-[13px] text-muted-foreground">
          Todavía no hay captions. Aparecen aquí cuando un video pasa por Filtro I.
        </p>
      ) : (
        <ul className="space-y-2">
          {analisis.map((a) => (
            <TarjetaCaption key={a.id} analisis={a} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TarjetaCaption({ analisis }: { analisis: AnalisisGrokIng }) {
  const [copiado, setCopiado] = useState(false)
  const vista = vistaEditor(analisis.status)
  // 'redactando' aquí SÍ se dice tal cual: en esta pantalla el caption es el
  // entregable, así que su estado es información útil, no una filtración.
  const escribiendo = analisis.status === 'redactando'

  const copiar = async () => {
    if (!analisis.captionFinal) return
    await navigator.clipboard.writeText(analisis.captionFinal)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <li className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{analisis.titulo}</p>
        <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
          {analisis.clientName}
        </span>
      </div>

      {analisis.captionFinal ? (
        <>
          <p className="whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-2.5 text-[13px] leading-snug">
            {analisis.captionFinal}
          </p>
          <button
            type="button"
            onClick={copiar}
            className={cn(
              'flex items-center gap-1.5 text-[12px] transition-colors',
              copiado ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {copiado ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copiado ? 'Copiado' : 'Copiar caption'}
          </button>
        </>
      ) : escribiendo ? (
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Escribiendo el caption…
        </p>
      ) : vista.fallo ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 p-2.5 text-[12px] text-destructive">
          {analisis.errorMensaje ?? 'El análisis falló.'}
        </p>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          El video todavía se está revisando.
        </p>
      )}

      {/* El caption base es la materia prima: útil para entender de dónde salió
          el caption final cuando no convence. */}
      {analisis.captionBase && (
        <details className="text-[12px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Ver de qué habla el video
          </summary>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-muted-foreground">
            {analisis.captionBase}
          </p>
        </details>
      )}
    </li>
  )
}
