'use client'

import { useCallback, useState } from 'react'
import { createSubmittedIdea } from '@/lib/actions/pipeline-submit'
import { getR2UploadUrl, registerR2Video } from '@/lib/actions/idea-videos-r2'
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
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`La subida falló (${xhr.status})`))
    xhr.onerror = () => reject(new Error('Se cortó la conexión durante la subida'))
    xhr.send(file)
  })
}

const deps: SubmitDeps = {
  createIdea: (i) => createSubmittedIdea(i),
  getUploadUrl: (i) => getR2UploadUrl(i),
  putFile: putWithProgress,
  registerVideo: (i) => registerR2Video(i),
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
            hook: v.hook,
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
