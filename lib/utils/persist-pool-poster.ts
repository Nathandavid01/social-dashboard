/**
 * Guarda un frame extraído (canvas) como poster en thumb_keys del mismo
 * video. Best-effort: si R2 o el registro fallan, la carátula en vivo
 * sigue en pantalla.
 */

import { getPoolPosterUploadUrl, registerPoolPoster } from '@/lib/actions/pool-covers'

export type PersistPoolPosterDeps = {
  toBlob?: (canvas: HTMLCanvasElement) => Promise<Blob | null>
  getUploadUrl?: (videoId: string) => Promise<{ url?: string; key?: string; error?: string }>
  register?: (videoId: string, key: string) => Promise<{ ok?: true; error?: string }>
  put?: (url: string, blob: Blob) => Promise<{ ok: boolean }>
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82)
  })
}

export async function persistPoolPosterFromCanvas(
  canvas: HTMLCanvasElement | null,
  videoId: string,
  deps: PersistPoolPosterDeps = {},
): Promise<{ ok: boolean }> {
  if (!canvas || !videoId) return { ok: false }
  const toBlob = deps.toBlob ?? canvasToBlob
  const getUploadUrl = deps.getUploadUrl ?? getPoolPosterUploadUrl
  const register = deps.register ?? registerPoolPoster
  const put = deps.put ?? (async (url, blob) => fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  }))

  let blob: Blob | null
  try {
    blob = await toBlob(canvas)
  } catch {
    return { ok: false }
  }
  if (!blob) return { ok: false }

  const slot = await getUploadUrl(videoId)
  if (slot.error || !slot.url || !slot.key) return { ok: false }

  try {
    const res = await put(slot.url, blob)
    if (!res.ok) return { ok: false }
  } catch {
    return { ok: false }
  }

  const saved = await register(videoId, slot.key)
  return { ok: saved.ok === true }
}
