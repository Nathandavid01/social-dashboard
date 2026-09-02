/**
 * Huella de un archivo de video SIN leerlo entero: tamaño + SHA-256 de tres
 * muestras (inicio, medio, fin). Dos subidas del mismo archivo dan la misma
 * huella aunque cambie el nombre; un re-export distinto da otra. Con 3 MB
 * leídos, tarda milisegundos incluso con 5 GB. Corre en el navegador
 * (crypto.subtle) antes de empezar a subir.
 *
 * Formato: `v1-<bytes>-<hex>`. El prefijo permite cambiar el algoritmo sin
 * confundir huellas viejas con nuevas.
 */
export const FINGERPRINT_SAMPLE_BYTES = 1024 * 1024

export async function fingerprintFile(file: Blob): Promise<string> {
  const size = file.size
  const n = FINGERPRINT_SAMPLE_BYTES
  const ranges: [number, number][] =
    size <= n * 3
      ? [[0, size]]
      : [
          [0, n],
          [Math.floor(size / 2) - Math.floor(n / 2), Math.floor(size / 2) - Math.floor(n / 2) + n],
          [size - n, size],
        ]
  const parts = await Promise.all(ranges.map(([a, b]) => readBlob(file.slice(a, b))))
  const total = parts.reduce((s, p) => s + p.byteLength, 0)
  const joined = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    joined.set(new Uint8Array(p), offset)
    offset += p.byteLength
  }
  const digest = await crypto.subtle.digest('SHA-256', joined)
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return `v1-${size}-${hex}`
}

/** `Blob.arrayBuffer()` falta en algunos entornos (jsdom, Safari viejo): FileReader de respaldo. */
function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}
