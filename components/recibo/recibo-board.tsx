'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { Bot, Check, Loader2, X } from 'lucide-react'
import { ClientLogo } from '@/components/clients/client-logo'
import { EnviarAlCliente, EnviarIdeaAlCliente } from '@/components/entregas/enviar-al-cliente'
import { ReciboVideoPreview } from '@/components/recibo/recibo-video-preview'
import { useToast } from '@/lib/hooks/use-toast'
import { setManualPostedStatus, setStaffClientApproval } from '@/lib/actions/recibo'
import { ideaTieneEditadoEntregas } from '@/lib/entregas/enviar-al-cliente'
import { rangoSemana } from '@/lib/entregas/dias'
import { cn } from '@/lib/utils'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Recibo — intake for clients with edit_mode='ai'.
 * Vertical 9:16 review cards: title, idea/hook, approve/reject, posted flags.
 * No Metricool auto-post.
 */

function enEstaSemana(idea: IdeaWithPipeline, semana = 0): boolean {
  const fecha = idea.publish_date || idea.submitted_at?.slice(0, 10) || idea.created_at?.slice(0, 10)
  if (!fecha) return false
  const { desde, hasta } = rangoSemana(undefined, semana)
  return fecha >= desde && fecha <= hasta
}

function ideaTitle(idea: IdeaWithPipeline): string {
  return idea.title?.trim() || idea.hook?.trim() || 'Sin título'
}

function ideaBrief(idea: IdeaWithPipeline): string | null {
  const hook = idea.hook?.trim()
  const title = idea.title?.trim()
  if (hook && hook !== title) return hook
  const angle = idea.caption_angle?.trim()
  if (angle) return angle
  const objective = idea.objective?.trim()
  if (objective) return objective
  return null
}

export function ReciboBoard({
  ideas,
  aiClients,
}: {
  ideas: IdeaWithPipeline[]
  aiClients: { id: string; name: string; logo_url?: string | null }[]
}) {
  const { toast } = useToast()
  const [soloSemana, setSoloSemana] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const filtered = useMemo(() => {
    const base = ideas.filter((i) => i.status !== 'descartada')
    if (!soloSemana) return base
    return base.filter((i) => enEstaSemana(i, 0))
  }, [ideas, soloSemana])

  const byClient = useMemo(() => {
    const map = new Map<string, { client: { id: string; name: string; logo_url?: string | null }; ideas: IdeaWithPipeline[] }>()
    for (const c of aiClients) {
      map.set(c.id, { client: c, ideas: [] })
    }
    for (const idea of filtered) {
      const entry = map.get(idea.client_id)
      if (entry) entry.ideas.push(idea)
      else {
        map.set(idea.client_id, {
          client: {
            id: idea.client_id,
            name: idea.client?.name?.trim() || 'Cliente',
            logo_url: idea.client?.logo_url ?? null,
          },
          ideas: [idea],
        })
      }
    }
    return [...map.values()].sort((a, b) => a.client.name.localeCompare(b.client.name, 'es'))
  }, [filtered, aiClients])

  function markPosted(ideaId: string, status: 'posted' | 'not_posted') {
    setPendingId(ideaId)
    start(async () => {
      const res = await setManualPostedStatus({ ideaId, status })
      if (res.error) toast({ title: 'No se pudo guardar', description: res.error, variant: 'destructive' })
      else toast({ title: status === 'posted' ? 'Marcado: Ya se posteó' : 'Marcado: No se posteó' })
      setPendingId(null)
    })
  }

  function markApproval(ideaId: string, status: 'approved' | 'rejected') {
    setPendingId(ideaId)
    start(async () => {
      const res = await setStaffClientApproval({ ideaId, status })
      if (res.error) toast({ title: 'No se pudo guardar', description: res.error, variant: 'destructive' })
      else toast({ title: status === 'approved' ? 'Aprobado' : 'No aprobado' })
      setPendingId(null)
    })
  }

  const semanaIdeas = useMemo(
    () => ideas.filter((i) => i.status !== 'descartada' && enEstaSemana(i, 0) && ideaTieneEditadoEntregas(i)),
    [ideas],
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6" data-testid="recibo-board">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
            <Bot className="h-5 w-5 shrink-0 text-violet-400" aria-hidden="true" />
            Recibo
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Revisa cada corte en 9:16, lee el título y la idea, y marca si el cliente aprueba.
            Sin auto-post a Metricool.
          </p>
        </div>
        <label className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-card/80 px-3.5 text-xs font-medium backdrop-blur sm:w-auto sm:justify-start">
          <input
            type="checkbox"
            checked={soloSemana}
            onChange={(e) => setSoloSemana(e.target.checked)}
            className="accent-primary"
          />
          Solo esta semana
        </label>
      </header>

      {aiClients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
          No hay clientes con modo de edición <strong>AI</strong>. Actívalo en el perfil del cliente
          (Resumen → Modo de edición).
        </div>
      ) : (
        <>
          <EnviarAlCliente ideas={semanaIdeas.length ? semanaIdeas : ideas} />

          <ul className="space-y-8">
            {byClient.map(({ client, ideas: clientIdeas }) => (
              <li key={client.id} className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <ClientLogo name={client.name} logoUrl={client.logo_url} className="h-11 w-11 ring-2 ring-border" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold">{client.name}</span>
                      <span
                        data-testid="recibo-ai-badge"
                        className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300"
                      >
                        AI
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {clientIdeas.length === 0
                        ? 'Sin videos en el filtro actual'
                        : `${clientIdeas.length} video${clientIdeas.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>

                {clientIdeas.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
                    No hay videos editados en el filtro actual.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                    {clientIdeas.map((idea) => {
                      const busy = isPending && pendingId === idea.id
                      const posted = idea.manual_posted_status
                      const approval = idea.staff_client_approval
                      const hasEdit = ideaTieneEditadoEntregas(idea)
                      const brief = ideaBrief(idea)
                      return (
                        <li
                          key={idea.id}
                          data-testid={`recibo-idea-${idea.id}`}
                          className="flex flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-card/80 shadow-md shadow-black/20"
                        >
                          <div className="bg-zinc-950 px-3 pb-2 pt-3 sm:px-4">
                            <div className="mx-auto w-full max-w-[min(100%,280px)]">
                              <ReciboVideoPreview ideaId={idea.id} hasEdited={hasEdit} />
                            </div>
                          </div>

                          <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="break-words text-[15px] font-semibold leading-snug tracking-tight">
                                  {ideaTitle(idea)}
                                </h3>
                                {busy && (
                                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                                )}
                              </div>
                              {brief ? (
                                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                                  {brief}
                                </p>
                              ) : (
                                <p className="text-sm italic text-muted-foreground/70">Sin idea / hook en el brief</p>
                              )}
                              <p className="text-[11px] text-muted-foreground/80">
                                {idea.publish_date ? `Publicación ${idea.publish_date}` : 'Sin fecha de publicación'}
                                {hasEdit ? ' · Editado' : ' · Sin archivo'}
                              </p>
                            </div>

                            <div className="mt-auto space-y-2 border-t border-border/60 pt-3">
                              {hasEdit ? <EnviarIdeaAlCliente idea={idea} /> : null}
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                ¿Aprueba el cliente?
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <ToggleBtn
                                  active={approval === 'approved'}
                                  disabled={busy}
                                  onClick={() => markApproval(idea.id, 'approved')}
                                  tone="ok"
                                  label="Aprobado por el cliente"
                                  shortLabel="Aprobar"
                                  icon={<Check className="h-4 w-4" aria-hidden="true" />}
                                  large
                                />
                                <ToggleBtn
                                  active={approval === 'rejected'}
                                  disabled={busy}
                                  onClick={() => markApproval(idea.id, 'rejected')}
                                  tone="warn"
                                  label="No aprobado"
                                  shortLabel="No aprobar"
                                  icon={<X className="h-4 w-4" aria-hidden="true" />}
                                  large
                                />
                              </div>
                              <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Publicación
                              </p>
                              <div className="flex gap-1.5">
                                <ToggleBtn
                                  active={posted === 'posted'}
                                  disabled={busy}
                                  onClick={() => markPosted(idea.id, 'posted')}
                                  tone="ok"
                                  label="Ya se posteó"
                                  icon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                />
                                <ToggleBtn
                                  active={posted === 'not_posted'}
                                  disabled={busy}
                                  onClick={() => markPosted(idea.id, 'not_posted')}
                                  tone="warn"
                                  label="No se posteó"
                                  icon={<X className="h-3.5 w-3.5" aria-hidden="true" />}
                                />
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function ToggleBtn({
  active,
  disabled,
  onClick,
  label,
  shortLabel,
  icon,
  tone,
  large,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  shortLabel?: string
  icon: ReactNode
  tone: 'ok' | 'warn'
  large?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl border font-semibold transition',
        large ? 'min-h-11 w-full px-3 text-sm' : 'min-h-11 flex-1 px-2.5 text-[11px] sm:min-h-9 sm:flex-none',
        active && tone === 'ok' && 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200',
        active && tone === 'warn' && 'border-amber-500/60 bg-amber-500/20 text-amber-100',
        !active && 'border-border bg-background/80 text-muted-foreground hover:bg-muted/60',
        disabled && 'opacity-50',
      )}
    >
      {icon}
      {shortLabel ?? label}
    </button>
  )
}
