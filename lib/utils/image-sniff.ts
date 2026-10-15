/**
 * Tell an image apart by its magic bytes. Some CDNs (static.metricool.com)
 * serve logos as `application/octet-stream`; browsers sniff them fine, but a
 * proxy that trusts only the header would reject them.
 */
export function sniffImageType(b: Uint8Array): string | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif'
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

/** The content type to serve, or null when the response is not an image. */
export function proxyImageType(declared: string, bytes: Uint8Array): string | null {
  const ct = declared.trim().toLowerCase()
  if (ct.startsWith('image/')) return declared
  if (ct === '' || ct.startsWith('application/octet-stream')) return sniffImageType(bytes)
  return null
}
