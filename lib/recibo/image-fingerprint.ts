import 'server-only'
import { createHash } from 'node:crypto'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { entregasR2Client, entregasR2Bucket } from '@/lib/integrations/entregas-r2'
import { r2Client, r2Bucket } from '@/lib/integrations/r2'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const TIMEOUT_MS = 3_000
// Metricool CDN URLs are immutable; bounded process caches let later runs advance.
const sizeCache = new Map<string,number>()
const hashCache = new Map<string,string>()
function remember<T>(cache:Map<string,T>,url:string,value:T) {
  cache.delete(url)
  cache.set(url,value)
  if (cache.size > 1000) cache.delete(cache.keys().next().value!)
}

async function fingerprint(chunks: AsyncIterable<Uint8Array>, signal: AbortSignal): Promise<string | undefined> {
  const hash = createHash('sha256')
  let bytes = 0
  for await (const chunk of chunks) {
    bytes += chunk.byteLength
    if (signal.aborted || bytes > MAX_IMAGE_BYTES) return undefined
    hash.update(chunk)
  }
  return bytes > 0 && !signal.aborted ? hash.digest('hex') : undefined
}

/** Read the original from its configured R2 account, never a caller-provided source URL. */
async function readSourceImageFingerprint(source: {storage_provider?:string|null;drive_file_id?:string|null}, signal:AbortSignal):Promise<string|undefined> {
  if (!source.drive_file_id) return undefined
  const client = source.storage_provider === 'entregas-r2' ? entregasR2Client() : source.storage_provider === 'r2' ? r2Client() : null
  if (!client) return undefined
  const bucket = source.storage_provider === 'entregas-r2' ? entregasR2Bucket() : r2Bucket()
  try {
    const object = await client.send(new GetObjectCommand({Bucket:bucket,Key:source.drive_file_id}),{abortSignal:signal})
    if (!object.Body) return undefined
    if ((object.ContentLength ?? 0) > MAX_IMAGE_BYTES) {
      (object.Body as {destroy?:()=>void}).destroy?.()
      return undefined
    }
    return await fingerprint(object.Body as AsyncIterable<Uint8Array>, signal)
  } catch { return undefined }
}

/** Only immutable Metricool CDN media; fail closed on redirects, oversized or unavailable files. */
async function readMetricoolImageFingerprint(url:string, signal:AbortSignal, sizes?:ReadonlySet<number>):Promise<string|undefined> {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'static.metricool.com' || parsed.username || parsed.password || parsed.port) return undefined
    if (sizes) {
      let size = sizeCache.get(url)
      if (size === undefined) {
        const head = await fetch(url,{method:'HEAD',redirect:'error',cache:'no-store',signal})
        size = Number(head.headers.get('content-length'))
        if (!head.ok || !Number.isFinite(size) || size <= 0) return undefined
        remember(sizeCache,url,size)
      }
      if (!sizes.has(size)) return undefined
    }
    const cached = hashCache.get(url)
    if (cached) return cached
    const res = await fetch(url,{redirect:'error',cache:'no-store',signal})
    if (!res.ok || !res.body || Number(res.headers.get('content-length')) > MAX_IMAGE_BYTES) {
      await res.body?.cancel().catch(()=>{})
      return undefined
    }
    // A reader keeps the allocation bounded even when content-length is missing or wrong.
    const reader = res.body.getReader()
    async function* chunks() {
      try {
        for (;;) { const next = await reader.read(); if (next.done) break; yield next.value }
      } finally { await reader.cancel().catch(()=>{}); reader.releaseLock() }
    }
    const hash = await fingerprint(chunks(),signal)
    if (hash) remember(hashCache,url,hash)
    return hash
  } catch { return undefined }
}

// Fair shared queue across accounts. Waiting counts against the image deadline.
let activeReads = 0
const waiting: (()=>void)[] = []
function acquire(signal:AbortSignal):Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false)
  if (activeReads < 3) { activeReads += 1; return Promise.resolve(true) }
  return new Promise(resolve=>{
    const start = ()=>{signal.removeEventListener('abort',cancel);activeReads += 1;resolve(true)}
    const cancel = ()=>{const index=waiting.indexOf(start);if(index>=0)waiting.splice(index,1);resolve(false)}
    waiting.push(start)
    signal.addEventListener('abort',cancel,{once:true})
  })
}
async function boundedRead(read:(signal:AbortSignal)=>Promise<string|undefined>, deadline?:number):Promise<string|undefined> {
  const remaining = Math.min(TIMEOUT_MS,(deadline ?? Date.now()+TIMEOUT_MS)-Date.now())
  if (remaining <= 0) return undefined
  const signal = AbortSignal.timeout(Math.floor(remaining))
  if (!await acquire(signal)) return undefined
  try { return await read(signal) } finally { activeReads -= 1; waiting.shift()?.() }
}
export function sourceImageFingerprint(source: {storage_provider?:string|null;drive_file_id?:string|null}, deadline?:number):Promise<string|undefined> {
  return boundedRead(signal=>readSourceImageFingerprint(source,signal),deadline)
}
export function metricoolImageFingerprint(url:string, deadline?:number, sizes?:ReadonlySet<number>):Promise<string|undefined> {
  return boundedRead(signal=>readMetricoolImageFingerprint(url,signal,sizes),deadline)
}
