'use client'

import { useCallback, useState } from 'react'
import { createSubmittedIdea } from '@/lib/actions/pipeline-submit'
import { getEntregasUploadUrl, registerEntregasVideo } from '@/lib/actions/entregas-r2'
import { prepararAnalisis } from '@/lib/actions/filtro-i'
import { submitOneVideo, type SubmitDeps, type SubmitStage } from '@/lib/utils/submit-upload-core'
import { extraerFrames, subirFrames } from './extraer-frames'
import type { SubmitVideoPayload } from '@/components/pipeline/submit-video-card'

/**
 * La entrega de Filtro I: subir el video y arrancar su análisis.
 *
 * Reusa la cadena de subida que ya existe (`submitOneVideo` + las acciones de
 * R2) SIN tocarla, y le añade lo propio de Filtro I: sacar los frames en el
 * navegador, subirlos y disparar el análisis.
 *
 * Los frames se sacan ANTES de subir el video: es cuando el archivo está en la
 * máquina y es gratis leerlo. Después de subir habría que volver a bajarlo.
 */

export type EtapaFiltroI = SubmitStage | 'frames' | 'analizando'

export interface FilaProgreso {
  title: string
  etapa: EtapaFiltroI
  pct: number
  error?: string
  /** El análisis ya creado — la tarjeta lo consulta para enseñar la tabla. */
  analisisId?: string
}

/** XHR en vez de fetch: fetch no informa del progreso de subida. */
function putConProgreso(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`La subida falló (${xhr.status})`))
    xhr.onerror = () =>
      reject(new Error('Se cortó la subida. Revisa tu conexión e inténtalo otra vez.'))
    xhr.ontimeout = () => reject(new Error('La subida tardó demasiado'))
    xhr.send(file)
  })
}

export function useFiltroISubmit(onDone?: () => void) {
  const [filas, setFilas] = useState<FilaProgreso[]>([])
  const [corriendo, setCorriendo] = useState(false)

  const submit = useCallback(
    async (payload: SubmitVideoPayload) => {
      setCorriendo(true)
      setFilas(payload.videos.map((v) => ({ title: v.title, etapa: 'creando' as EtapaFiltroI, pct: 0 })))

      const parche = (i: number, cambios: Partial<FilaProgreso>) =>
        setFilas((f) => f.map((fila, j) => (j === i ? { ...fila, ...cambios } : fila)))

      for (let i = 0; i < payload.videos.length; i++) {
        const v = payload.videos[i]

        // 1. Frames primero, con el archivo aún en la máquina.
        let extraidos
        try {
          parche(i, { etapa: 'frames', pct: 0 })
          extraidos = await extraerFrames(v.file as File)
        } catch (err) {
          // El video no se sube: entregarlo sin análisis dejaría al editor
          // esperando una tabla que nunca va a llegar.
          parche(i, { etapa: 'error', error: err instanceof Error ? err.message : 'No se pudieron sacar los frames' })
          continue
        }

        // 2. La cadena de subida de siempre.
        let videoId: string | undefined
        const deps: SubmitDeps = {
          createIdea: (input) => createSubmittedIdea(input),
          getUploadUrl: (input) =>
            getEntregasUploadUrl({ ideaId: input.ideaId, fileName: input.fileName, contentType: input.contentType }),
          putFile: putConProgreso,
          registerVideo: async (input) => {
            const res = await registerEntregasVideo({
              ideaId: input.ideaId,
              key: input.key,
              name: input.name,
              sizeBytes: input.sizeBytes,
              mimeType: input.mimeType,
            })
            // La firma compartida no expone el id; se guarda aquí porque el
            // análisis lo necesita y modificar la firma tocaría el otro flujo.
            videoId = res.id
            return res
          },
        }

        const res = await submitOneVideo(
          deps,
          {
            clientId: payload.clientId,
            title: v.title,
            hook: null,
            driveLink: v.driveLink,
            publishDate: v.publishDate,
            file: v.file as File,
          },
          (etapa, pct) => parche(i, { etapa, pct }),
        )

        if (!res.ok || !res.ideaId || !videoId) {
          parche(i, { etapa: 'error', error: res.error ?? 'No se pudo entregar el video' })
          continue
        }

        // 3. Frames a R2 y a analizar.
        try {
          parche(i, { etapa: 'analizando', pct: 100 })
          const prep = await prepararAnalisis({
            ideaId: res.ideaId,
            videoId,
            momentos: extraidos.momentos,
          })
          if (prep.error || !prep.analisisId || !prep.urls) {
            throw new Error(prep.error ?? 'No se pudo preparar el análisis')
          }
          await subirFrames(extraidos.frames, prep.urls)

          parche(i, { analisisId: prep.analisisId })
          // Sin await: el análisis tarda ~1 min y el editor ya puede irse. La
          // tarjeta consulta el estado por su cuenta.
          void fetch('/api/filtro-i/analizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analisisId: prep.analisisId }),
          })
        } catch (err) {
          // El video YA está entregado; lo que falló es el análisis. Se dice
          // así para que nadie lo vuelva a subir pensando que se perdió.
          parche(i, {
            etapa: 'error',
            error: `Video entregado, pero el análisis no arrancó: ${err instanceof Error ? err.message : 'error'}`,
          })
        }
      }

      setCorriendo(false)
      onDone?.()
    },
    [onDone],
  )

  return { submit, filas, corriendo }
}
