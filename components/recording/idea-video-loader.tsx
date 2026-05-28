'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { IdeaVideoPanel } from './idea-video-panel'
import { getIdeaVideos } from '@/lib/actions/idea-videos'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

interface Props {
  ideaId: string
  ideaTitle?: string
  compact?: boolean
}

/**
 * Self-loading wrapper around IdeaVideoPanel. Use this when you don't already
 * have the videos in a parent prefetch — it issues a server action call on
 * mount and re-renders. For lists with N ideas, prefer to fetch in bulk in
 * the parent and pass `videos` straight to IdeaVideoPanel.
 */
export function IdeaVideoLoader({ ideaId, ideaTitle, compact }: Props) {
  const [videos, setVideos] = useState<ContentIdeaVideo[] | null>(null)

  useEffect(() => {
    let alive = true
    getIdeaVideos(ideaId).then((rows) => {
      if (alive) setVideos(rows)
    })
    return () => { alive = false }
  }, [ideaId])

  if (videos === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Cargando videos…
      </div>
    )
  }

  return <IdeaVideoPanel ideaId={ideaId} ideaTitle={ideaTitle} videos={videos} compact={compact} />
}
