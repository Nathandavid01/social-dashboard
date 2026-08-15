'use client'

import { useEffect, useRef, useState } from 'react'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import { shouldAutoDraftCaption } from '@/lib/utils/idea-ready'

/**
 * One in-flight (or resolved) auto-draft per idea. Shared across remounts so
 * React Strict Mode and opening the same card twice don't spend two LLM calls.
 */
const inflight = new Map<string, Promise<string | null>>()

export function resetAutoDraftAttempts() {
  inflight.clear()
}

function autoDraftCaptionOnce(ideaId: string): Promise<string | null> {
  const existing = inflight.get(ideaId)
  if (existing) return existing
  const p = generateIdeaCaption(ideaId, { auto: true })
    .then((res) => res.caption ?? null)
    .catch(() => {
      inflight.delete(ideaId)
      return null
    })
  inflight.set(ideaId, p)
  return p
}

/**
 * Al abrir una idea lista, pide un borrador. No pisa draft ni caption
 * aprobado (`shouldAutoDraftCaption`). Una sola llamada por ideaId.
 */
export function useAutoDraftCaption({
  ideaId,
  hook,
  hasVideo = false,
  captionDraft,
  generatedCaption,
  enabled = true,
  onDraft,
}: {
  ideaId: string
  hook?: string | null
  hasVideo?: boolean
  captionDraft?: string | null
  generatedCaption?: string | null
  enabled?: boolean
  onDraft?: (caption: string) => void
}): { autoDrafting: boolean } {
  const [autoDrafting, setAutoDrafting] = useState(false)
  const onDraftRef = useRef(onDraft)
  onDraftRef.current = onDraft

  useEffect(() => {
    if (!enabled || !ideaId) return
    if (!shouldAutoDraftCaption({
      hook,
      hasVideo,
      caption_draft: captionDraft,
      generated_caption: generatedCaption,
    })) return

    let cancelled = false
    setAutoDrafting(true)
    void autoDraftCaptionOnce(ideaId).then((caption) => {
      if (cancelled) return
      if (caption) onDraftRef.current?.(caption)
      setAutoDrafting(false)
    })
    return () => {
      cancelled = true
    }
  }, [ideaId, hook, hasVideo, captionDraft, generatedCaption, enabled])

  return { autoDrafting }
}
