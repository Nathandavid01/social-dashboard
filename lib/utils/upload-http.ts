'use client'

/**
 * Thin XHR wrapper for a single PUT (whole file or one multipart part).
 * XHR rather than fetch: fetch has no upload progress events, and no clean
 * way to abort mid-flight the way XHR + AbortSignal does.
 */
export interface PutBlobOptions {
  /** Called with bytes sent so far (not a percent — caller aggregates). */
  onProgress?: (loadedBytes: number) => void
  signal?: AbortSignal
}

export interface PutBlobResult {
  /** S3/R2 returns the part's ETag — required to complete the multipart upload. */
  etag: string | null
}

/** `name` y `status` los lee el motor para decidir cómo reintentar (sin importar esta clase). */
export class UploadHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`)
    this.name = 'UploadHttpError'
  }
}

/** No hubo respuesta: se cayó la red (no un rechazo del servidor). */
export class UploadNetworkError extends Error {
  constructor() {
    super('Error de red durante la subida')
    this.name = 'UploadNetworkError'
  }
}

export function putBlob(url: string, blob: Blob, contentType: string, opts: PutBlobOptions = {}): Promise<PutBlobResult> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    if (contentType) xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ etag: xhr.getResponseHeader('ETag') })
      } else {
        reject(new UploadHttpError(xhr.status))
      }
    }
    xhr.onerror = () => reject(new UploadNetworkError())
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'))
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => xhr.abort())
    }
    xhr.send(blob)
  })
}
