'use client'

import { useCallback, useState } from 'react'
import { createSubmittedIdea, reportUploadFailure } from '@/lib/actions/pipeline-submit'
import { getEntregasUploadUrl, registerEntregasVideo } from '@/lib/actions/entregas-r2'
import { submitOneVideo, type SubmitDeps, type SubmitStage } from '@/lib/utils/submit-upload-core'
import type { SubmitVideoPayload } from './submit-video-card'

/**
 * Drives the real submit: one video at a time, so a laptop on hotel wifi isn't
 * racing five uploads at once. A failure stops that video only — the rest of
 * the batch still goes through, and the row it created stays behind so nothing
 * has to be retyped.
 */

export interface RowProgress {
  title: string
  stage: SubmitStage
  pct: number
  error?: string
}

/** XHR rather than fetch: fetch has no upload progress events. */
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      void reportUploadFailure(
        `${file.name} (${file.size}b) → HTTP ${xhr.status} :: ${(xhr.responseText || '').slice(0, 300)}`,
      )
      reject(new Error(`La subida falló (${xhr.status})`))
    }
    // Un bloqueo de CORS llega aquí, no a onload, y el navegador oculta el
    // status real — por eso hay que reportarlo explícitamente.
    xhr.onerror = () => {
      void reportUploadFailure(`${file.name} (${file.size}b) → onerror, sin status (CORS o red)`)
      reject(new Error('No se pudo subir — revisa la política CORS del bucket'))
    }
    xhr.ontimeout = () => {
      void reportUploadFailure(`${file.name} (${file.size}b) → timeout`)
      reject(new Error('La subida tardó demasiado'))
    }
    xhr.send(file)
  })
}

const deps: SubmitDeps = {
  createIdea: (i) => createSubmittedIdea(i),
  getUploadUrl: (i) => getEntregasUploadUrl({ ideaId: i.ideaId, fileName: i.fileName, contentType: i.contentType }),
  putFile: putWithProgress,
  registerVideo: (i) =>
    registerEntregasVideo({ ideaId: i.ideaId, key: i.key, name: i.name, sizeBytes: i.sizeBytes, mimeType: i.mimeType }),
}

export function useSubmitVideos(onDone?: () => void) {
  const [rows, setRows] = useState<RowProgress[]>([])
  const [running, setRunning] = useState(false)

  const submit = useCallback(
    async (payload: SubmitVideoPayload) => {
      setRunning(true)
      setRows(payload.videos.map((v) => ({ title: v.title, stage: 'creando' as SubmitStage, pct: 0 })))

      for (let i = 0; i < payload.videos.length; i++) {
        const v = payload.videos[i]
        const res = await submitOneVideo(
          deps,
          {
            clientId: payload.clientId,
            title: v.title,
            // "De qué es el video" se escribe en Copy, donde hace falta para la
            // IA. Pedírselo al editor era pedirle un dato que no usa.
            hook: null,
            driveLink: v.driveLink,
            file: v.file,
          },
          (stage, pct) =>
            setRows((r) => r.map((row, j) => (j === i ? { ...row, stage, pct } : row))),
        )
        if (!res.ok) {
          setRows((r) =>
            r.map((row, j) => (j === i ? { ...row, stage: 'error' as SubmitStage, error: res.error } : row)),
          )
        }
      }

      setRunning(false)
      onDone?.()
    },
    [onDone],
  )

  const clear = useCallback(() => setRows([]), [])

  return { submit, rows, running, clear }
}
