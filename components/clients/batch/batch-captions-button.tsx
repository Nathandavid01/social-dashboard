'use client'

import { useMemo, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import { hasCaptionableVideo } from '@/lib/utils/idea-ready'
import { displayCaptionDraft } from '@/lib/utils/caption-draft'
import { MAX_HERMANOS } from '@/lib/utils/caption-angles'
import type { BatchVideo } from '@/lib/utils/batch-view'

const filled = (s?: string | null) => !!s && s.trim().length > 0
const hasFile = (v: BatchVideo) =>
  hasCaptionableVideo([...v.videos.raw, ...v.videos.broll, ...v.videos.edited])

/**
 * One click → AI caption DRAFTS for every video in the batch that has neither a
 * saved caption nor a pending draft. Uses the exact same engine + learning loop
 * as the per-video editor (generateIdeaCaption resolves client voice, approved
 * examples and 👍/👎 server-side from the idea id). Runs SEQUENTIALLY to be
 * gentle on the LLM API and shows N/M progress on the button itself.
 *
 * Nothing here moves a video: the drafts land in `caption_draft`, and each card
 * still needs a human to read it and press Guardar. Before that split, this one
 * button shipped the whole batch to Publicación unreviewed.
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

  // Un borrador pendiente ya ocupa el hueco: regenerarlo encima pisaría el
  // texto que alguien está por revisar.
  const missing = useMemo(
    () =>
      videos.filter(
        (v) =>
          v.status !== 'descartada' &&
          hasFile(v) &&
          !filled(v.generated_caption) &&
          !filled(v.caption_draft),
      ),
    [videos],
  )

  if (!canUse || missing.length === 0) return null
  const running = progress !== null

  async function generateAll() {
    setProgress({ done: 0, total: missing.length })
    let ok = 0
    let failed = 0
    // Sequential on purpose: N parallel LLM calls would race the rate limit
    // and make partial failures hard to attribute. It also lets each caption
    // "meet" the ones already written for this batch: hermanos acumula los
    // captions ya generados (título + texto) y se los pasa al siguiente video,
    // para que no salgan genéricos ni se repitan entre sí (Pieza 1). Arranca
    // sembrado con los captions que YA existían en el lote (guardados o en
    // borrador) — no solo los generados en esta corrida — porque `missing`
    // excluye esos videos y de otro modo el generador nunca los vería. Un
    // lote grande no debe hacer crecer este array sin tope: se limita a los
    // MAX_HERMANOS más recientes (mismo tope que aplica el servidor).
    let hermanos: { titulo: string; caption: string }[] = videos
      .filter(
        (v) =>
          v.status !== 'descartada' &&
          v.status !== 'publicada' &&
          !v.published_at &&
          (filled(v.generated_caption) || filled(v.caption_draft)),
      )
      .map((v) => ({ titulo: v.title ?? '', caption: displayCaptionDraft(v.generated_caption || v.caption_draft) }))
      .filter((h) => filled(h.caption))
      .slice(-MAX_HERMANOS)
    for (let i = 0; i < missing.length; i++) {
      try {
        const res = await generateIdeaCaption(missing[i].id, { hermanos: [...hermanos] })
        if (res?.error) {
          failed++
        } else {
          ok++
          if (res?.caption) {
            hermanos = [...hermanos, { titulo: missing[i].title ?? '', caption: res.caption }].slice(-MAX_HERMANOS)
          }
        }
      } catch {
        failed++
      }
      setProgress({ done: i + 1, total: missing.length })
    }
    setProgress(null)
    if (ok > 0 && failed === 0) {
      toast({ title: `${ok} borradores listos`, description: 'Ninguno se envió: revísalos y guárdalos tarjeta por tarjeta.' })
    } else if (ok > 0) {
      toast({
        title: `${ok} borradores listos`,
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
          <Sparkles className="h-4 w-4" /> Generar {missing.length} {missing.length === 1 ? 'borrador' : 'borradores'}
        </>
      )}
    </Button>
  )
}
