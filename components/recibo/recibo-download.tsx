'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { getReciboIdeaDownloadUrl } from '@/lib/actions/recibo'
import { followDownload } from '@/lib/utils/follow-download'

/**
 * "Bajar" on a Recibo card: downloads the exact cut the card is playing.
 * Signed on click — the URLs last 1h and the board stays open longer.
 */
export function ReciboDownloadButton({
  ideaId,
  videoId,
  title,
}: {
  ideaId: string
  videoId: string
  title: string
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  async function bajar() {
    setLoading(true)
    const fail = (description = 'Vuelve a intentar.') =>
      toast({ title: 'No se pudo bajar', description, variant: 'destructive' })
    try {
      const res = await getReciboIdeaDownloadUrl(ideaId, videoId)
      if (res.url) followDownload(res.url)
      else fail(res.error)
    } catch {
      fail()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      aria-label={`Bajar ${title}`}
      disabled={loading}
      onClick={() => void bajar()}
      className="absolute left-2 top-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/70 px-3 text-xs font-semibold text-white hover:bg-black disabled:opacity-70"
    >
      {loading
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
      Bajar
    </button>
  )
}
