import type { SocialPlatform } from '@/lib/supabase/types'

/**
 * The post formats each social network can publish (via Metricool), per its API.
 * Sibling of "caption único": the caption is one for all networks, but the
 * FORMAT can differ per network (e.g. a Reel on Instagram, a Video on TikTok).
 *
 * Stored on content_ideas.platform_formats as { network: formatValue }. The
 * PRESENCE of a network key means that network is selected for the video; the
 * value is the chosen format. It does not change WHERE a video publishes (that
 * still comes from the client's connected networks) — only the format per net.
 */
export interface PlatformFormat {
  value: string
  label: string
}

export const PLATFORM_FORMATS: Record<SocialPlatform, PlatformFormat[]> = {
  instagram: [
    { value: 'reel', label: 'Reel' },
    { value: 'carousel', label: 'Carrusel' },
    { value: 'image', label: 'Imagen' },
    { value: 'story', label: 'Historia' },
  ],
  facebook: [
    { value: 'reel', label: 'Reel' },
    { value: 'image', label: 'Imagen' },
    { value: 'story', label: 'Historia' },
    { value: 'video', label: 'Video' },
  ],
  tiktok: [
    { value: 'video', label: 'Video' },
    { value: 'photo', label: 'Foto' },
  ],
  linkedin: [
    { value: 'post', label: 'Publicación' },
    { value: 'video', label: 'Video' },
    { value: 'document', label: 'Documento' },
  ],
}

/** The default (most common) format for a platform — its first/native format. */
export function defaultFormatFor(platform: SocialPlatform): string {
  return PLATFORM_FORMATS[platform]?.[0]?.value ?? 'video'
}

/** Build the default `{ network: format }` map for the given networks. */
export function defaultPlatformFormats(platforms: SocialPlatform[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of platforms) {
    if (PLATFORM_FORMATS[p]) out[p] = defaultFormatFor(p)
  }
  return out
}

/** Whether `format` is a format the given platform actually supports. */
export function isValidFormat(platform: SocialPlatform, format: string): boolean {
  return !!PLATFORM_FORMATS[platform]?.some((f) => f.value === format)
}

/** Spanish label for a platform format; falls back to the raw value. */
export function formatLabel(platform: SocialPlatform, format: string): string {
  return PLATFORM_FORMATS[platform]?.find((f) => f.value === format)?.label ?? format
}
