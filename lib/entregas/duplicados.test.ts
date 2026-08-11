import { describe, it, expect } from 'vitest'
import { archivosRepetidos, type IdeaConArchivos } from './duplicados'

/**
 * El mismo archivo editado, registrado como varios videos.
 *
 * Cada envío crea una fila nueva en content_ideas: no hay camino de "reemplazar
 * el video", así que resubir el mismo corte tras un "cambios pedidos", o un
 * doble clic, lo deja dos veces en el tablero. En la base de datos había 9
 * grupos así, varios con FECHAS DISTINTAS — el mismo video anunciado para dos
 * días. Eso es un cruce real, y hasta ahora nada lo señalaba.
 */

const archivo = (name: string, size: number, over: Record<string, unknown> = {}) => ({
  id: `v-${name}-${size}`,
  name,
  size_bytes: size,
  kind: 'edited',
  storage_provider: 'entregas-r2',
  uploaded_at: '2026-08-01T10:00:00Z',
  ...over,
})

const idea = (over: Partial<IdeaConArchivos> = {}): IdeaConArchivos => ({
  id: 'i1',
  client_id: 'c1',
  status: 'producida',
  publish_date: '2026-08-03',
  videos: [archivo('guira.mp4', 100)],
  ...over,
})

describe('archivosRepetidos', () => {
  it('un video con archivo único no se marca', () => {
    expect(archivosRepetidos([idea()])).toEqual({})
  })

  it('el mismo archivo en dos fechas se marca en los dos videos', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', publish_date: '2026-08-03' }),
      idea({ id: 'b', publish_date: '2026-08-07' }),
    ])
    expect(Object.keys(r).sort()).toEqual(['a', 'b'])
    expect(r.a.fechas).toEqual(['2026-08-07'])
    expect(r.b.fechas).toEqual(['2026-08-03'])
  })

  it('cuenta cuántos otros videos comparten el archivo', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', publish_date: '2026-08-03' }),
      idea({ id: 'b', publish_date: '2026-08-07' }),
      idea({ id: 'c', publish_date: '2026-08-07' }),
    ])
    expect(r.a.otros).toBe(2)
    // Una fecha repetida se lista una vez: lo que importa es en qué días sale.
    expect(r.a.fechas).toEqual(['2026-08-07'])
  })

  it('el doble clic —mismo archivo, misma fecha— también se marca', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', publish_date: '2026-08-11' }),
      idea({ id: 'b', publish_date: '2026-08-11' }),
    ])
    expect(r.a.otros).toBe(1)
    expect(r.a.fechas).toEqual(['2026-08-11'])
  })

  it('archivos distintos del mismo cliente no se confunden', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', videos: [archivo('uno.mp4', 100)] }),
      idea({ id: 'b', videos: [archivo('dos.mp4', 100)] }),
    ])
    expect(r).toEqual({})
  })

  it('mismo nombre pero distinto tamaño son videos distintos', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', videos: [archivo('video 1.mp4', 100)] }),
      idea({ id: 'b', videos: [archivo('video 1.mp4', 250)] }),
    ])
    expect(r).toEqual({})
  })

  // Dos clientes pueden mandar un "final.mp4" del mismo peso sin que tenga
  // nada que ver: cruzarlos inventaría un problema donde no lo hay.
  it('el mismo archivo en clientes distintos no es un duplicado', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', client_id: 'c1' }),
      idea({ id: 'b', client_id: 'c2' }),
    ])
    expect(r).toEqual({})
  })

  it('lo descartado no cuenta: ya no está en el tablero', () => {
    const r = archivosRepetidos([
      idea({ id: 'a' }),
      idea({ id: 'b', status: 'descartada', publish_date: '2026-08-07' }),
    ])
    expect(r).toEqual({})
  })

  it('solo mira el archivo editado de Entregas', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', videos: [archivo('crudo.mp4', 100, { kind: 'raw' })] }),
      idea({ id: 'b', videos: [archivo('crudo.mp4', 100, { kind: 'raw' })] }),
    ])
    expect(r).toEqual({})
  })

  it('ignora el material del bucket viejo del pipeline', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', videos: [archivo('x.mp4', 100, { storage_provider: 'r2' })] }),
      idea({ id: 'b', videos: [archivo('x.mp4', 100, { storage_provider: 'r2' })] }),
    ])
    expect(r).toEqual({})
  })

  it('sin nombre o sin tamaño no se puede afirmar nada, y no se afirma', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', videos: [archivo('', 0, { name: null, size_bytes: null })] }),
      idea({ id: 'b', videos: [archivo('', 0, { name: null, size_bytes: null })] }),
    ])
    expect(r).toEqual({})
  })

  it('un video sin archivos no rompe nada', () => {
    expect(archivosRepetidos([idea({ id: 'a', videos: [] })])).toEqual({})
  })

  it('una idea sin cliente no se cruza con otra sin cliente', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', client_id: null }),
      idea({ id: 'b', client_id: null }),
    ])
    expect(r).toEqual({})
  })

  it('con varias subidas en la misma idea usa la más reciente', () => {
    const r = archivosRepetidos([
      idea({
        id: 'a',
        videos: [
          archivo('viejo.mp4', 100, { uploaded_at: '2026-08-01T10:00:00Z' }),
          archivo('nuevo.mp4', 200, { uploaded_at: '2026-08-05T10:00:00Z' }),
        ],
      }),
      idea({ id: 'b', publish_date: '2026-08-09', videos: [archivo('nuevo.mp4', 200)] }),
    ])
    expect(Object.keys(r).sort()).toEqual(['a', 'b'])
  })

  it('las fechas salen ordenadas', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', publish_date: '2026-08-01' }),
      idea({ id: 'b', publish_date: '2026-08-09' }),
      idea({ id: 'c', publish_date: '2026-08-05' }),
    ])
    expect(r.a.fechas).toEqual(['2026-08-05', '2026-08-09'])
  })

  it('un video sin fecha entre los repetidos no ensucia la lista', () => {
    const r = archivosRepetidos([
      idea({ id: 'a', publish_date: '2026-08-01' }),
      idea({ id: 'b', publish_date: null }),
    ])
    expect(r.a.otros).toBe(1)
    expect(r.a.fechas).toEqual([])
  })
})
