/**
 * The logo to show for a client: a manually-uploaded logo wins; otherwise the
 * brand picture synced from Metricool; otherwise null (UI shows initials).
 * Pure + dependency-free for easy testing.
 */
export function resolveClientLogo(
  logoUrl: string | null | undefined,
  metricoolPicture: string | null | undefined,
): string | null {
  if (logoUrl && logoUrl.trim()) return logoUrl
  if (metricoolPicture && metricoolPicture.trim()) return metricoolPicture
  return null
}
