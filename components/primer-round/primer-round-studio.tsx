'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Clapperboard,
  Film,
  Lightbulb,
  PencilLine,
  ClipboardCheck,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Users,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClientLogo } from '@/components/clients/client-logo'
import { cn } from '@/lib/utils'
import {
  generatePrimerRoundCaption,
  verifyPrimerRoundOrtho,
  schedulePrimerRoundReel,
  type PrimerRoundStudioPayload,
  type PrimerRoundStudioIdea,
} from '@/lib/actions/primer-round'
import type { PrimerRoundOrthoGate } from '@/lib/primer-round/orthography'
import {
  PRIMER_ROUND_CAPTION_TEMPLATE_SKELETON,
  PRIMER_ROUND_HASHTAGS,
  PRIMER_ROUND_CAPTION_HOSTS,
} from '@/lib/primer-round/caption-template'
import { useRouter } from 'next/navigation'

const LANE_META = [
  { key: 'ideas' as const, label: 'Ideas', icon: Lightbulb, hrefKey: 'ideas' as const, hint: 'Escribir / refinar' },
  { key: 'bank' as const, label: 'Banco', icon: Film, hrefKey: 'bank' as const, hint: 'Crudos listos' },
  { key: 'editing' as const, label: 'En edición', icon: PencilLine, hrefKey: 'editing' as const, hint: 'Corte en curso' },
  { key: 'review' as const, label: 'Revisión', icon: ClipboardCheck, hrefKey: 'review' as const, hint: 'Por aprobar' },
]

export function PrimerRoundStudio({ studio }: { studio: PrimerRoundStudioPayload }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(studio.ready[0]?.id ?? null)
  const selected = useMemo(
    () => studio.ready.find((i) => i.id === selectedId) ?? studio.ready[0] ?? null,
    [studio.ready, selectedId],
  )
  const [caption, setCaption] = useState<string | null>(selected?.caption ?? null)
  const [gate, setGate] = useState<PrimerRoundOrthoGate | null>(null)
  const [overrideOrtho, setOverrideOrtho] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function pick(idea: PrimerRoundStudioIdea) {
    setSelectedId(idea.id)
    setCaption(idea.caption)
    setGate(null)
    setMessage(null)
    setOverrideOrtho(false)
  }

  function runGenerate() {
    if (!selected) return
    setMessage(null)
    startTransition(async () => {
      const res = await generatePrimerRoundCaption(selected.id)
      if (res.error) {
        setMessage(res.error)
        return
      }
      setCaption(res.caption ?? null)
      setGate(null)
      setMessage('Caption de IG creado (debajo del Reel).')
      router.refresh()
    })
  }

  function runVerify() {
    if (!selected) return
    setMessage(null)
    startTransition(async () => {
      const res = await verifyPrimerRoundOrtho(selected.id)
      if (res.gate) setGate(res.gate)
      if (res.error) setMessage(res.error)
      else setMessage(res.gate?.ok ? 'Verificación OK: overlay + caption.' : 'Hay problemas de ortografía.')
    })
  }

  function runSchedule() {
    if (!selected) return
    setMessage(null)
    startTransition(async () => {
      const res = await schedulePrimerRoundReel({
        ideaId: selected.id,
        overrideOrtho,
      })
      if (res.error) setMessage(res.error)
      else if (res.skipped) setMessage(res.skipped)
      else {
        setMessage(`Agendado en Metricool${res.metricoolPostId != null ? ` #${res.metricoolPostId}` : ''}.`)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-xl border bg-card p-4 sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-40 blur-2xl"
          style={{ background: 'linear-gradient(135deg, #f59e0b, transparent 70%)' }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ClientLogo name={studio.client.name} logoUrl={studio.client.logoUrl} className="h-10 w-10 text-[11px]" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                Estudio Primer Round
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                @{studio.client.igHandle} · blog {studio.client.blogId} · videos → Metricool Reel
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" /> Collabs
            </Badge>
            {studio.collabs.map((c) => (
              <Badge key={c.username} variant="outline" className="font-mono text-[11px]">
                @{c.username}
              </Badge>
            ))}
          </div>
        </div>
        <p className="relative mt-3 text-xs text-muted-foreground">
          Crear: caption de IG debajo del Reel (plantilla bloqueada @primerroundoficial). Verificar: overlay
          lower-third (3–4 líneas) + ese caption. Hosts en caption como nombres ({PRIMER_ROUND_CAPTION_HOSTS});
          collabs Metricool-only. Auto-agenda{' '}
          {studio.autopostEnabled ? 'activa' : 'apagada (PRIMER_ROUND_AUTOPOST=false)'}.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LANE_META.map((lane) => {
          const Icon = lane.icon
          const items = studio.lanes[lane.key]
          const href = studio.ctas[lane.hrefKey]
          return (
            <Link
              key={lane.key}
              href={href}
              className="rounded-xl border bg-card/60 p-3 transition hover:border-primary/40 hover:bg-card"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="h-4 w-4 text-amber-600" /> {lane.label}
                </span>
                <span className="tabular-nums text-lg font-semibold">{items.length}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{lane.hint} → flujo existente</p>
            </Link>
          )
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Clapperboard className="h-4 w-4" /> Listos para publicar
            </h2>
            <Badge variant="outline" className="tabular-nums">{studio.ready.length}</Badge>
          </div>
          {studio.ready.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
              No hay videos aprobados pendientes de Metricool.
            </p>
          ) : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {studio.ready.map((idea) => (
                <li key={idea.id}>
                  <button
                    type="button"
                    onClick={() => pick(idea)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                      selected?.id === idea.id ? 'border-amber-500/50 bg-amber-500/10' : 'hover:bg-muted/40',
                    )}
                  >
                    <span className="block truncate font-medium">{idea.title}</span>
                    <span className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      <span>{idea.caption ? 'Con caption' : 'Sin caption IG'}</span>
                      <span>
                        Overlay:{' '}
                        {idea.overlayText
                          ? idea.overlayIssues > 0
                            ? `${idea.overlayIssues} aviso(s)`
                            : 'OK'
                          : 'sin análisis'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="outline">
              <Link href={studio.ctas.review}>Ir a Revisión</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={studio.ctas.pipeline}>Ir a Pipeline</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={studio.ctas.onsite}>On Site</Link>
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
          <h2 className="text-sm font-semibold">Caption IG + verificación + agenda</h2>
          {!selected ? (
            <p className="text-xs text-muted-foreground">Selecciona un video listo.</p>
          ) : (
            <>
              <p className="truncate text-sm font-medium">{selected.title}</p>

              <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3" data-testid="primer-round-caption-panel">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Caption debajo del Reel (crear · plantilla AI bloqueada)
                </p>
                <details className="rounded-md border bg-background/60 px-2 py-1.5" data-testid="primer-round-caption-template">
                  <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                    Ver plantilla @primerroundoficial ({PRIMER_ROUND_HASHTAGS})
                  </summary>
                  <pre className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/90">
{PRIMER_ROUND_CAPTION_TEMPLATE_SKELETON}
                  </pre>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Overlay verify: lower-third blanco · 3–4 líneas · L1 rol+nombre · resto pregunta/cita · sin #/@.
                  </p>
                </details>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed">
                  {caption?.trim() || '— Sin caption aún. Genera con la plantilla bloqueada.'}
                </pre>
                <Button size="sm" onClick={runGenerate} disabled={pending}>
                  {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                  Crear caption IG
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/20 p-3" data-testid="primer-round-ortho-panel">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Verificar overlay + caption
                </p>
                {gate ? (
                  <div className="space-y-2 text-xs">
                    <OrthoRow
                      ok={gate.overlay.ok && !gate.overlay.missing}
                      label="Texto overlay (en pantalla)"
                      detail={
                        gate.overlay.missing
                          ? 'Sin texto overlay / análisis'
                          : gate.overlay.ok
                            ? 'Sin errores'
                            : `${gate.overlay.issues.length} a corregir`
                      }
                    />
                    <OrthoRow
                      ok={gate.caption.ok && !gate.caption.missing}
                      label="Caption de IG (abajo)"
                      detail={
                        gate.caption.missing
                          ? 'Falta caption'
                          : gate.caption.ok
                            ? 'Sin errores'
                            : `${gate.caption.issues.length} a corregir`
                      }
                    />
                    {[...gate.overlay.issues, ...gate.caption.issues].length > 0 && (
                      <ul className="space-y-1 rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
                        {[...gate.overlay.issues, ...gate.caption.issues].map((issue, idx) => (
                          <li key={`${issue.surface}-${idx}`}>
                            <span className="font-medium">[{issue.surface}]</span> «{issue.quote}» — {issue.problem}
                            {issue.suggestion ? ` → ${issue.suggestion}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Corre la verificación antes de agendar. Se revisa el burn-in y el caption de abajo.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={runVerify} disabled={pending}>
                    {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
                    Verificar ortografía
                  </Button>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={overrideOrtho}
                      onChange={(e) => setOverrideOrtho(e.target.checked)}
                    />
                    Override Eric (publicar igual)
                  </label>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  Metricool Reel · collabs
                </p>
                <p className="text-xs text-muted-foreground">
                  Se agenda en @{studio.client.igHandle} con{' '}
                  {studio.collabs.map((c) => `@${c.username}`).join(' + ')}.
                </p>
                <Button size="sm" onClick={runSchedule} disabled={pending || (!gate?.ok && !overrideOrtho)}>
                  {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                  Agendar Reel en Metricool
                </Button>
              </div>
            </>
          )}
          {message && (
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs" role="status">
              {message}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function OrthoRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 font-medium">
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        )}
        {label}
      </span>
      <span className={cn('text-[10px]', ok ? 'text-emerald-600' : 'text-amber-600')}>{detail}</span>
    </div>
  )
}
