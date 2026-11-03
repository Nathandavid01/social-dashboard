/** Static cover on a calendar card. Never a playable video file. */
export type CalendarMedia = {
  url?: string
  type?: string
  thumbnail?: string
  thumbnailUrl?: string
  poster?: string
  preview?: string
  previewUrl?: string
  imageUrl?: string
}

const VIDEO_FILE = /\.(mp4|mov|webm|m4v)(?:\?|$)/i
const IMAGE_FILE = /\.(jpe?g|png|gif|webp|avif)(?:\?|$)/i

function firstImage(...candidates: Array<string | undefined>): string | null {
  for (const raw of candidates) {
    const url = raw?.trim()
    if (!url || VIDEO_FILE.test(url)) continue
    return url
  }
  return null
}

export function calendarCoverUrl(media: CalendarMedia[] | undefined, videoThumbnailUrl?: string | null): string | null {
  if (media?.length) {
    for (const item of media) {
      const named = firstImage(item.thumbnail, item.thumbnailUrl, item.poster, item.preview, item.previewUrl, item.imageUrl)
      if (named) return named
    }
  }
  const fromPost = firstImage(videoThumbnailUrl ?? undefined)
  if (fromPost) return fromPost
  for (const item of media ?? []) {
    const url = item.url?.trim()
    if (!url || VIDEO_FILE.test(url) || item.type?.toLowerCase().includes('video')) continue
    if (item.type?.toLowerCase().includes('image') || IMAGE_FILE.test(url)) return url
  }
  return null
}
