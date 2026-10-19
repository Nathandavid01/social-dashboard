'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { getVideoDownloadUrl } from '@/lib/actions/video-download'
import { followDownload } from '@/lib/utils/follow-download'
import { cn } from '@/lib/utils'

/**
 * Bajar an edited (or other stored) file by video id, routing to the correct
 * R2 bucket. Inventario and other surfaces without Recibo's cut-pin use this
 * instead of ReciboDownloadButton (which requires entregas.read).
 */
export function VideoDownloadButton({
  videoId,
  title,
  className,
}: {
  videoId: string
  title: string
  className?: string
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  async function bajar() {
    setLoading(true)
    const fail = (description = 'Vuelve a intentar.') =>
      toast({ title: 'No se pudo bajar', description, variant: 'destructive' })
    try {
      const res = await getVideoDownloadUrl(videoId)
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
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/20 px-2 text-[10px] font-semibold text-white hover:bg-white/10 disabled:opacity-70',
        className,
      )}
    >
      {loading
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
      Bajar
    </button>
  )
}
