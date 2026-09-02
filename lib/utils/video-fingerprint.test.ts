import { describe, it, expect } from 'vitest'
import { fingerprintFile, FINGERPRINT_SAMPLE_BYTES } from './video-fingerprint'

function file(bytes: Uint8Array, name = 'a.mp4') {
  return new File([bytes as unknown as BlobPart], name, { type: 'video/mp4' })
}
function bytes(n: number, seed = 1) {
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) out[i] = (i * 31 + seed) & 0xff
  return out
}

describe('fingerprintFile', () => {
  it('el mismo contenido da la misma huella aunque cambie el nombre', async () => {
    const a = await fingerprintFile(file(bytes(5000), 'IMG_0001.MOV'))
    const b = await fingerprintFile(file(bytes(5000), 'final v2.mp4'))
    expect(a).toBe(b)
    expect(a).toMatch(/^v1-5000-[0-9a-f]{64}$/)
  })

  it('contenido distinto del mismo tamaño da huella distinta', async () => {
    const a = await fingerprintFile(file(bytes(5000, 1)))
    const b = await fingerprintFile(file(bytes(5000, 2)))
    expect(a).not.toBe(b)
  })

  it('un archivo grande solo lee tres muestras (inicio, medio, fin), no el archivo entero', async () => {
    const big = bytes(FINGERPRINT_SAMPLE_BYTES * 10)
    const f = file(big)
    let read = 0
    const orig = f.slice.bind(f)
    ;(f as { slice: typeof f.slice }).slice = (start?: number, end?: number, ct?: string) => {
      read += (end ?? f.size) - (start ?? 0)
      return orig(start, end, ct)
    }
    await fingerprintFile(f)
    expect(read).toBe(FINGERPRINT_SAMPLE_BYTES * 3)
  })

  it('cambiar bytes del medio de un archivo grande cambia la huella', async () => {
    const a = bytes(FINGERPRINT_SAMPLE_BYTES * 10)
    const b = new Uint8Array(a)
    b[Math.floor(b.length / 2) + 10] ^= 0xff
    expect(await fingerprintFile(file(a))).not.toBe(await fingerprintFile(file(b)))
  })

  it('archivo vacío tiene huella estable', async () => {
    expect(await fingerprintFile(file(new Uint8Array(0)))).toMatch(/^v1-0-/)
  })
})
