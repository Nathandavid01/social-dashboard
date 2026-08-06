'use client'

import { momentosDeMuestreo } from '@/lib/filtro-i/frames'

/**
 * Saca frames del video EN EL NAVEGADOR, con <video> y <canvas>.
 *
 * Aquí y no en el servidor porque el video sube directo del navegador a R2: la
 * función nunca tiene el archivo, y bajarse 100–200 MB para sacar 24 JPEG la
 * pondría a pelear con su límite de tiempo y de memoria en cada entrega. Aquí
 * el archivo ya está en la máquina del editor y sacarlo cuesta segundos.
 *
 * Sin ffmpeg y sin wasm: `<video>` decodifica y `<canvas>` captura, que es
 * justo lo que hace falta. Nada que instalar ni que cargar.
 */

/** Ancho máximo del frame. Suficiente para leer un subtítulo, y ligero de subir. */
const ANCHO_MAX = 720
const CALIDAD_JPEG = 0.7
/** Un seek que no responde no puede colgar la entrega para siempre. */
const TIMEOUT_SEEK_MS = 10_000

export interface FramesExtraidos {
  momentos: number[]
  frames: Blob[]
}

export class ErrorExtraccion extends Error {}

function esperarEvento(el: HTMLMediaElement, evento: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const limpiar = () => {
      el.removeEventListener(evento, ok)
      el.removeEventListener('error', fallo)
      clearTimeout(temporizador)
    }
    const ok = () => {
      limpiar()
      resolve()
    }
    const fallo = () => {
      limpiar()
      reject(new ErrorExtraccion('El navegador no pudo leer este video.'))
    }
    const temporizador = setTimeout(() => {
      limpiar()
      reject(new ErrorExtraccion('El navegador tardó demasiado leyendo el video.'))
    }, ms)
    el.addEventListener(evento, ok, { once: true })
    el.addEventListener('error', fallo, { once: true })
  })
}

function aBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new ErrorExtraccion('No se pudo generar el frame.'))),
      'image/jpeg',
      CALIDAD_JPEG,
    )
  })
}

/**
 * Devuelve los frames y el segundo de cada uno.
 *
 * Lanza `ErrorExtraccion` con un mensaje que se le puede enseñar a una persona:
 * si el navegador no sabe decodificar este contenedor (pasa en Safari con
 * algunos mp4/AAC), el editor tiene que enterarse — no puede quedarse creyendo
 * que su video se está analizando cuando no hay frames que analizar.
 */
export async function extraerFrames(file: File): Promise<FramesExtraidos> {
  if (typeof document === 'undefined') {
    throw new ErrorExtraccion('La extracción de frames solo corre en el navegador.')
  }

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  // Sin esto Safari puede negarse a pintar el frame en el canvas.
  video.playsInline = true
  video.src = url

  try {
    await esperarEvento(video, 'loadedmetadata', TIMEOUT_SEEK_MS)

    const momentos = momentosDeMuestreo(video.duration)
    if (!momentos.length) {
      throw new ErrorExtraccion('No se pudo leer la duración del video.')
    }

    const escala = Math.min(1, ANCHO_MAX / (video.videoWidth || ANCHO_MAX))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round((video.videoWidth || ANCHO_MAX) * escala))
    canvas.height = Math.max(1, Math.round((video.videoHeight || ANCHO_MAX) * escala))

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ErrorExtraccion('Este navegador no puede procesar el video.')

    const frames: Blob[] = []
    for (const t of momentos) {
      video.currentTime = t
      await esperarEvento(video, 'seeked', TIMEOUT_SEEK_MS)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      frames.push(await aBlob(canvas))
    }

    return { momentos, frames }
  } finally {
    // Pase lo que pase: sin esto el archivo entero se queda en memoria.
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
    video.load()
  }
}

/** Sube cada frame a su URL prefirmada. Falla entera: analizar con la mitad de
 *  los frames daría una tabla de errores incompleta que parece completa. */
export async function subirFrames(frames: Blob[], urls: string[]): Promise<void> {
  if (frames.length !== urls.length) {
    throw new ErrorExtraccion('No coinciden los frames con sus destinos.')
  }
  for (let i = 0; i < frames.length; i++) {
    const res = await fetch(urls[i], {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: frames[i],
    })
    if (!res.ok) throw new ErrorExtraccion(`No se pudo subir el frame ${i + 1}.`)
  }
}
