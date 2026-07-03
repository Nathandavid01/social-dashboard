'use client'

import { useMemo, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import type { BatchVideo } from '@/lib/utils/batch-view'

const filled = (s?: string | null) => !!s && s.trim().length > 0

/**
 * One click → AI captions for every video in the batch that's missing one.
 * Uses the exact same engine + learning loop as the per-video editor
 * (generateIdeaCaption resolves client voice, approved examples and 👍/👎
 * server-side from the idea id). Runs SEQUENTIALLY to be gentle on the LLM
 * API and shows N/M progress on the button itself.
 */
export function BatchCaptionsButton({
  videos,
  onDone,
}: {
  videos: BatchVideo[]
  onDone: () => void
}) {
  const canUse = useHasPermission('captions.use')
  const { toast } = useToast()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const missing = useMemo(
    () => videos.filter((v) => v.status !== 'descartada' && !filled(v.generated_caption)),
    [videos],
  )

  if (!canUse || missing.length === 0) return null
  const running = progress !== null

  async function generateAll() {
    setProgress({ done: 0, total: missing.length })
    let ok = 0
    let failed = 0
    // Sequential on purpose: N parallel LLM calls would race the rate limit
    // and make partial failures hard to attribute.
    for (let i = 0; i < missing.length; i++) {
      try {
        const res = await generateIdeaCaption(missing[i].id)
        if (res?.error) failed++
        else ok++
      } catch {
        failed++
      }
      setProgress({ done: i + 1, total: missing.length })
    }
    setProgress(null)
    if (ok > 0 && failed === 0) {
      toast({ title: `${ok} captions generados`, description: 'Revísalos y ajústalos en cada tarjeta.' })
    } else if (ok > 0) {
      toast({
        title: `${ok} captions generados`,
        description: `${failed} ${failed === 1 ? 'falló' : 'fallaron'} — suele faltar la idea (hook + brief). Revisa esas tarjetas.`,
      })
    } else {
      toast({
        title: 'No se generó ningún caption',
        description: `${failed} ${failed === 1 ? 'falló' : 'fallaron'} — revisa que cada video tenga su idea (hook + brief).`,
        variant: 'destructive',
      })
    }
    onDone()
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={running} onClick={generateAll}>
      {running ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Generando {progress.done}/{progress.total}…
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" /> Generar {missing.length} {missing.length === 1 ? 'caption' : 'captions'}
        </>
      )}
    </Button>
  )
}
