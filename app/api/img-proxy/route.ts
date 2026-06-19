import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Block obvious SSRF targets (loopback / private / link-local / metadata). */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h === 'metadata.google.internal') return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a === 0 || a === 127 || a === 10) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 169 && b === 254) return true
  }
  if (h === '::1' || h.startsWith('fe80') || h.startsWith('fc') || h.startsWith('fd')) return true
  return false
}

/**
 * Same-origin image proxy so report thumbnails (Instagram/Facebook CDN, which
 * don't send CORS headers) can be read by html2canvas when exporting the PDF.
 * Authenticated only (prevents an open proxy) and restricted to https images.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('No autorizado', { status: 401 })

  const u = req.nextUrl.searchParams.get('u')
  if (!u) return new NextResponse('Falta el parámetro u', { status: 400 })

  let url: URL
  try {
    url = new URL(u)
  } catch {
    return new NextResponse('URL inválida', { status: 400 })
  }
  if (url.protocol !== 'https:') return new NextResponse('Solo https', { status: 400 })
  if (isBlockedHost(url.hostname)) return new NextResponse('Host no permitido', { status: 400 })

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return new NextResponse('No disponible', { status: 502 })
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.startsWith('image/')) return new NextResponse('No es una imagen', { status: 415 })
    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      headers: { 'content-type': ct, 'cache-control': 'public, max-age=3600' },
    })
  } catch {
    return new NextResponse('Error al obtener la imagen', { status: 502 })
  }
}
