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

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    // Strip the leading slash to get the R2 object key.
    const key = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''))

    // Only final (edited) videos are public. Guard against path traversal and
    // require an exact `/edited/` path segment.
    const isEdited = /(^|\/)edited\//.test(key)
    if (!key || key.includes('..') || !isEdited) {
      return new Response('Not Found', { status: 404 })
    }

    const object = await env.VIDEOS.get(key)
    if (!object) return new Response('Not Found', { status: 404 })

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    // Immutable final asset — let the CDN and Metricool cache it hard.
    headers.set('cache-control', 'public, max-age=31536000, immutable')

    return new Response(request.method === 'HEAD' ? null : object.body, { headers })
  },
}
