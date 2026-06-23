import 'server-only'

/**
 * Pre-flight a public video URL the way a streaming player (Metricool's post
 * preview, a social-network ingest, an HTML <video>) would: a tiny Range
 * request that MUST come back as `206 Partial Content` with `Accept-Ranges`.
 *
 * A plain `200` (no range support) is exactly what made Metricool's preview
 * spin forever — so we treat it as unplayable and block the publish before the
 * bad URL ever reaches Metricool. Used both at publish time (idea-posting) and
 * by the daily health cron.
 */

export type VideoHealth = { ok: true } | { ok: false; reason: string }

export async function checkVideoPlayable(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VideoHealth> {
  if (!url) return { ok: false, reason: 'URL del video vacía' }

  let res: Response
  try {
    res = await fetchImpl(url, { headers: { Range: 'bytes=0-1' }, redirect: 'follow' })
  } catch (e) {
    return {
      ok: false,
      reason: `No se pudo alcanzar el video (${e instanceof Error ? e.message : 'error de red'})`,
    }
  }

  if (res.status === 404) {
    return { ok: false, reason: 'El video no existe en el almacenamiento (HTTP 404)' }
  }
  if (res.status !== 206) {
    return {
      ok: false,
      reason: `El video no soporta streaming por rangos (HTTP ${res.status}); el preview/publicación puede quedarse cargando`,
    }
  }
  if (!res.headers.get('accept-ranges')) {
    return { ok: false, reason: 'El video respondió 206 pero sin Accept-Ranges' }
  }
  return { ok: true }
}
