/**
 * Cloudflare Worker — public gateway for FINAL videos only.
 *
 * The R2 bucket `nmedia-videos` stays PRIVATE (no public domain on the bucket
 * itself). This Worker is the only public door, and it only serves objects
 * whose key sits under an `/edited/` segment:
 *
 *     ideas/{ideaId}/edited/{ts}-{slug}   ->  served (public, final videos)
 *     ideas/{ideaId}/raw/...              ->  404 (private raw footage)
 *     ideas/{ideaId}/broll/...            ->  404 (private b-roll)
 *
 * This mirrors the app-level guard in lib/actions/idea-videos-r2.ts
 * (getR2PublicUrl only returns a URL for kind === 'edited').
 *
 * ── Why Range + CORS matter ──────────────────────────────────────────────────
 * Video players (Metricool's post preview, social-network ingestion, the HTML
 * <video> element) STREAM via HTTP Range requests and expect `206 Partial
 * Content` + `Accept-Ranges: bytes`. A plain `200` with the full body makes the
 * preview spin forever. We also expose permissive CORS so cross-origin players
 * (fetch/XHR-based, like Metricool's preview) can read the bytes.
 *
 * ── Deploy ──────────────────────────────────────────────────────────────────
 * 1. Bind the bucket to this Worker (wrangler.toml):
 *
 *      name = "nmedia-public-videos"
 *      main = "infra/r2-public-edited-worker.js"
 *      compatibility_date = "2025-01-01"
 *
 *      [[r2_buckets]]
 *      binding = "VIDEOS"
 *      bucket_name = "nmedia-videos"
 *
 * 2. `npx wrangler deploy`
 * 3. Map a route/custom domain (e.g. videos.natemedia.com) to this Worker.
 * 4. Set that domain (no trailing slash) as R2_PUBLIC_BASE_URL in the app env.
 *
 * Keep the bucket's own "Public access" DISABLED — the Worker is the gate.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'Range, Content-Type',
  'access-control-expose-headers': 'Content-Length, Content-Range, Accept-Ranges, ETag',
  'access-control-max-age': '86400',
}

/** Normalize R2's R2Range ({offset,length} | {offset} | {suffix}) to absolute bounds. */
export function rangeBounds(range, size) {
  if (range.suffix != null) {
    const len = Math.min(range.suffix, size)
    return { start: size - len, len }
  }
  const start = range.offset ?? 0
  const len = range.length ?? size - start
  return { start, len }
}

export default {
  async fetch(request, env) {
    // CORS preflight.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS })
    }

    // Strip the leading slash to get the R2 object key.
    const key = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''))

    // Only final (edited) videos are public. Guard against path traversal and
    // require an exact `/edited/` path segment.
    const isEdited = /(^|\/)edited\//.test(key)
    if (!key || key.includes('..') || !isEdited) {
      return new Response('Not Found', { status: 404, headers: CORS })
    }

    const rangeHeader = request.headers.get('range')
    const object = await env.VIDEOS.get(key, rangeHeader ? { range: request.headers } : undefined)
    if (!object) return new Response('Not Found', { status: 404, headers: CORS })

    const headers = new Headers(CORS)
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('accept-ranges', 'bytes')
    // Immutable final asset — let the CDN and Metricool cache it hard.
    headers.set('cache-control', 'public, max-age=31536000, immutable')

    // `object.range` is set when a satisfiable Range was requested → 206.
    let status = 200
    if (rangeHeader && object.range) {
      const { start, len } = rangeBounds(object.range, object.size)
      headers.set('content-range', `bytes ${start}-${start + len - 1}/${object.size}`)
      headers.set('content-length', String(len))
      status = 206
    } else {
      headers.set('content-length', String(object.size))
    }

    return new Response(request.method === 'HEAD' ? null : object.body, { status, headers })
  },
}
