'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, AlertCircle, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFiltroIPreviewUrl } from '@/lib/actions/filtro-i'
import { vistaEditor } from '@/lib/filtro-i/estado-ui'
import type { EstadoFiltroI } from '@/lib/filtro-i/pasos'
import type { ErrorDetectado } from '@/lib/llm/grok-vision-core'
import { TablaErrores } from './tabla-errores'

/**
 * Un video entregado y lo que el análisis encontró en él.
 *
 * Enseña el video y la tabla de errores. NO enseña el caption ni deja intuir
 * que existe: el estado 'redactando' se traduce a "Listo" (ver estado-ui). El
 * caption vive en Grok-ing.
 */

export interface AnalisisResumen {
  id: string
  videoId: string
  titulo: string
  clientName: string
  status: EstadoFiltroI
  errores: ErrorDetectado[]
  errorMensaje: string | null
}

/** Cada 5s: el análisis tarda ~1 min, así que consultar más seguido solo gasta. */
const POLL_MS = 5000

export function AnalisisCard({ analisis }: { analisis: AnalisisResumen }) {
  const [status, setStatus] = useState<EstadoFiltroI>(analisis.status)
  const [errores, setErrores] = useState<ErrorDetectado[]>(analisis.errores)
  const [errorMensaje, setErrorMensaje] = useState<string | null>(analisis.errorMensaje)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [cargandoVideo, setCargandoVideo] = useState(false)

  const vista = vistaEditor(status)

  useEffect(() => {
    if (vista.terminado) return
    let vivo = true

    const tick = async () => {
      try {
        const res = await fetch(`/api/filtro-i/analizar?analisisId=${analisis.id}`)
        if (!res.ok || !vivo) return
        const data = await res.json()
        if (!vivo) return
        setStatus(data.status as EstadoFiltroI)
        setErrores((data.errores ?? []) as ErrorDetectado[])
        setErrorMensaje(data.error_mensaje ?? null)
      } catch {
        // Un fallo de red puntual no cambia nada: el siguiente tick reintenta.
      }
    }

    const id = setInterval(tick, POLL_MS)
    return () => {
      vivo = false
      clearInterval(id)
    }
  }, [analisis.id, vista.terminado])

  // La URL se firma cuando alguien quiere ver el video, no al cargar la
  // página: firmar una por tarjeta serían decenas de firmas que nadie usa.
  const verVideo = useCallback(async () => {
    setCargandoVideo(true)
    const res = await getFiltroIPreviewUrl(analisis.videoId)
    setVideoUrl(res.url ?? null)
    setCargandoVideo(false)
  }, [analisis.videoId])

  return (
    <li className="space-y-2.5 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{analisis.titulo}</p>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold',
            vista.fallo
              ? 'bg-destructive/10 text-destructive'
              : vista.terminado
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {!vista.terminado && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          {vista.fallo && <AlertCircle className="h-3 w-3" aria-hidden="true" />}
          {vista.etiqueta}
        </span>
      </div>

      <p className="truncate text-[11px] text-muted-foreground">{analisis.clientName}</p>

      {videoUrl ? (
        <video src={videoUrl} controls playsInline className="w-full rounded-lg" />
      ) : (
        <button
          type="button"
          onClick={verVideo}
          disabled={cargandoVideo}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {cargandoVideo ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Ver el video
        </button>
      )}

      {vista.fallo ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 p-2.5 text-[12px] leading-snug text-destructive">
          {errorMensaje ?? 'El análisis falló.'}
        </p>
      ) : vista.terminado ? (
        <TablaErrores errores={errores} />
      ) : (
        <p className="text-[12px] text-muted-foreground">
          Revisando el video. Puedes cerrar esto: cuando vuelvas estará aquí.
        </p>
      )}
    </li>
  )
}
