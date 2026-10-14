'use client'

import { useEffect, useRef, useState } from 'react'
import { Film } from 'lucide-react'
import { getVideoThumbViewUrls } from '@/lib/actions/video-thumbs'

/** Images only: never fetch a playback URL or mount a hidden video for a cover. */
export function ReciboThumbnail({ videoId, title, coverUrl, image = false }: { videoId: string; title: string; coverUrl?: string | null; image?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failedCover, setFailedCover] = useState<string | null>(null)
  const existingCover = coverUrl && coverUrl !== failedCover ? coverUrl : null
  const imageUrl = existingCover || url
  useEffect(() => {
    if (existingCover) return
    let alive = true
    let started = false
    setUrl(null)
    setLoading(true)
    const load = async () => {
      if (started) return
      started = true
      try {
        const result = await getVideoThumbViewUrls(videoId)
        if (alive) setUrl(result.urls[0] ?? null)
      } catch { /* The card remains usable when its image is unavailable. */ }
      finally { if (alive) setLoading(false) }
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer?.disconnect()
        void load()
      }
    }, { rootMargin: '240px' })
    if (observer && ref.current) observer.observe(ref.current)
    else void load()
    return () => { alive = false; observer?.disconnect() }
  }, [videoId, existingCover])

  return <span ref={ref} className={`relative flex ${image ? 'aspect-[4/5]' : 'aspect-[9/16]'} w-full items-center justify-center overflow-hidden bg-slate-100`}>
    {imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img data-testid="recibo-thumbnail" src={imageUrl} alt={`Miniatura de ${title}`} loading="lazy" decoding="async" onError={() => existingCover ? setFailedCover(existingCover) : setUrl(null)} className="h-full w-full object-contain" />
    ) : <span className="flex items-center gap-2 text-xs text-slate-500"><Film className="h-5 w-5" />{loading ? 'Cargando miniatura…' : 'Miniatura no disponible'}</span>}
  </span>
}
