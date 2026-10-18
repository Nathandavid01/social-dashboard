import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
const send = vi.hoisted(() => vi.fn())
vi.mock('@/lib/integrations/entregas-r2', () => ({ entregasR2Client: () => ({send}), entregasR2Bucket: () => 'entregas' }))
vi.mock('@/lib/integrations/r2', () => ({ r2Client: () => ({send}), r2Bucket: () => 'pipeline' }))
import { metricoolImageFingerprint, sourceImageFingerprint } from './image-fingerprint'
beforeEach(() => { vi.clearAllMocks() })

describe('image fingerprints', () => {
  it('lee bytes de la cuenta R2 correcta y calcula SHA-256', async () => {
    send.mockResolvedValue({ContentLength:3, Body: {async *[Symbol.asyncIterator](){yield Buffer.from('abc')}}})
    expect(await sourceImageFingerprint({storage_provider:'entregas-r2',drive_file_id:'edited/a.png'})).toBe(createHash('sha256').update('abc').digest('hex'))
    expect(send.mock.calls[0][0].input).toEqual({Bucket:'entregas',Key:'edited/a.png'})
  })
  it('omite proveedores desconocidos y archivos grandes sin leer el cuerpo', async () => {
    expect(await sourceImageFingerprint({storage_provider:'drive',drive_file_id:'a'})).toBeUndefined()
    expect(send).not.toHaveBeenCalled()
    const destroy = vi.fn()
    send.mockResolvedValue({ContentLength:100_000_000,Body:{destroy}})
    expect(await sourceImageFingerprint({storage_provider:'r2',drive_file_id:'a'})).toBeUndefined()
    expect(destroy).toHaveBeenCalledTimes(1)
  })
  it('no descarga hosts ajenos a Metricool ni sigue redirecciones', async () => {
    const fetcher = vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('abc',{status:200}))
    expect(await metricoolImageFingerprint('https://example.com/a.png')).toBeUndefined()
    expect(fetcher).not.toHaveBeenCalled()
    expect(await metricoolImageFingerprint('https://static.metricool.com/a.png')).toBe(createHash('sha256').update('abc').digest('hex'))
    expect(fetcher.mock.calls[0][1]).toMatchObject({redirect:'error',cache:'no-store'})
    fetcher.mockRestore()
  })
  it('un error de lectura no es evidencia de publicación', async () => {
    send.mockRejectedValue(new Error('network'))
    expect(await sourceImageFingerprint({storage_provider:'r2',drive_file_id:'a.png'})).toBeUndefined()
  })
})

it('limita las descargas simultáneas entre cuentas y atiende la cola en orden', async()=>{
  let finish!:()=>void
  const pending = new Promise<void>(resolve=>{finish=resolve})
  send.mockImplementation(async()=>{await pending;return {ContentLength:3,Body:{async *[Symbol.asyncIterator](){yield Buffer.from('abc')}}}})
  const reads = Array.from({length:3},()=>sourceImageFingerprint({storage_provider:'r2',drive_file_id:'a.png'}))
  const fourth = sourceImageFingerprint({storage_provider:'r2',drive_file_id:'fourth.png'})
  await Promise.resolve()
  expect(send).toHaveBeenCalledTimes(3)
  finish()
  await Promise.all(reads)
  expect(await fourth).toBe(createHash('sha256').update('abc').digest('hex'))
  expect(send).toHaveBeenCalledTimes(4)
})
it('corta un cuerpo que supera el límite aunque el encabezado mienta',async()=>{
  send.mockResolvedValue({ContentLength:3,Body:{async *[Symbol.asyncIterator](){yield new Uint8Array(11*1024*1024)}}})
  expect(await sourceImageFingerprint({storage_provider:'r2',drive_file_id:'a.png'})).toBeUndefined()
})

it('descarta imágenes históricas de otro tamaño antes de descargar y compara la candidata posterior',async()=>{
  const fetcher = vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
    const url=String(input)
    if(init?.method==='HEAD')return new Response(null,{headers:{'content-length':url.includes('old')?'100':'3'}})
    return new Response('abc')
  })
  try {
    const sizes = new Set([3])
    expect(await metricoolImageFingerprint('https://static.metricool.com/old.png',undefined,sizes)).toBeUndefined()
    expect(await metricoolImageFingerprint('https://static.metricool.com/current.png',undefined,sizes)).toBe(createHash('sha256').update('abc').digest('hex'))
    expect(fetcher.mock.calls.filter(([,init])=>init?.method!=='HEAD').map(([url])=>url)).toEqual(['https://static.metricool.com/current.png'])
  }finally{fetcher.mockRestore()}
})

it('reutiliza cabeceras inmutables para avanzar más allá del historial ya descartado',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async(_input,init)=>init?.method==='HEAD'?new Response(null,{headers:{'content-length':'3'}}):new Response('abc'))
  try {
    const url='https://static.metricool.com/cache-progress.png'
    expect(await metricoolImageFingerprint(url,undefined,new Set([2]))).toBeUndefined()
    expect(await metricoolImageFingerprint(url,undefined,new Set([3]))).toBe(createHash('sha256').update('abc').digest('hex'))
    expect(fetcher.mock.calls.filter(([,init])=>init?.method==='HEAD')).toHaveLength(1)
    expect(await metricoolImageFingerprint(url,undefined,new Set([3]))).toBe(createHash('sha256').update('abc').digest('hex'))
    expect(fetcher.mock.calls).toHaveLength(2)
  }finally{fetcher.mockRestore()}
})
