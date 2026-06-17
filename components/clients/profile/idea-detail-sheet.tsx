'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { getIdeaDetailBundle, type IdeaDetailBundle } from '@/lib/actions/content-ideas'
import { IdeaProgressBar } from '@/components/produccion/idea-progress-bar'
import { IdeaStudioCompact } from '@/components/produccion/idea-studio'
import { IdeaActivityTimeline } from '@/components/produccion/idea-activity-timeline'

const TYPE_LABEL: Record<string, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }

interface Props {
  ideaId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Side panel that consolidates one video's whole workflow — ideation, captions,
 * uploaded videos and the activity history — opened from the Flujo board without
 * leaving the client. Reuses the same components as /produccion/idea/[id]; the
 * bundle is fetched lazily on open via getIdeaDetailBundle.
 */
export function IdeaDetailSheet({ ideaId, open, onOpenChange }: Props) {
  const [bundle, setBundle] = useState<IdeaDetailBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !ideaId) {
      setBundle(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getIdeaDetailBundle(ideaId).then((res) => {
      if (cancelled) return
      if (res.error || !res.bundle) setError(res.error ?? 'No se pudo cargar la idea')
      else setBundle(res.bundle)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, ideaId])

  const idea = bundle?.idea

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {loading && !bundle ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <p className="py-16 text-center text-sm text-red-500">{error}</p>
        ) : idea && bundle ? (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2 pr-6">
                <span className="min-w-0 truncate">{idea.title}</span>
                <Badge variant="outline" className="shrink-0">
                  {TYPE_LABEL[idea.content_type] ?? idea.content_type}
                </Badge>
              </SheetTitle>
              <SheetDescription>Ideación, captions, videos e historial de este video.</SheetDescription>
            </SheetHeader>

            <IdeaProgressBar progress={bundle.progress} />
            <IdeaStudioCompact ideaId={idea.id} idea={idea} videos={bundle.videos} />
            <IdeaActivityTimeline activities={bundle.activity} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
