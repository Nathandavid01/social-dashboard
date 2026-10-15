import { resolveClientLogo } from '@/lib/utils/client-logo'

/**
 * Logo shown for a client: uploaded logo, else its Metricool profile picture.
 * Routed through the same-origin /api/img-proxy so WebGL can use it as a
 * texture (Instagram/Facebook/Metricool CDNs send no CORS headers).
 */
export function proxiedClientLogo(
  client: { logo_url: string | null; metricool_blog_id: string | number | null },
  pictures: Record<string, string>,
): string | null {
  const url = resolveClientLogo(
    client.logo_url,
    client.metricool_blog_id != null ? pictures[String(client.metricool_blog_id)] : null,
  )
  return url ? `/api/img-proxy?u=${encodeURIComponent(url)}` : null
}
