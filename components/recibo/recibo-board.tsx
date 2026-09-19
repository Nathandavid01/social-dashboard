'use client'

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { Bot, Check, Loader2, X } from 'lucide-react'
import { ClientLogo } from '@/components/clients/client-logo'
import { EditorSubmitSlot } from '@/components/pipeline/editor-submit-slot'
import { EnviarAlCliente } from '@/components/entregas/enviar-al-cliente'
import { useToast } from '@/lib/hooks/use-toast'
import { setManualPostedStatus, setStaffClientApproval } from '@/lib/actions/recibo'
import { ideaTieneEditadoEntregas } from '@/lib/entregas/enviar-al-cliente'
import { rangoSemana } from '@/lib/entregas/dias'
import { cn } from '@/lib/utils'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import type { DiaKey } from '@/lib/entregas/dias'

/**
 * Recibo — intake for clients with edit_mode='ai'.
 * Staff uploads already-edited videos to Entregas R2 (never overwrites Pipeline raw),
 * marks posted / client approval by hand, and can send "esta semana" via /aprobacion.
 * No Metricool auto-post.
 */

function enEstaSemana(idea: IdeaWithPipeline, semana = 0): boolean {
  const fecha = idea.publish_date || idea.submitted_at?.slice(0, 10) || idea.created_at?.slice(0, 10)
  if (!fecha) return false
  const { desde, hasta } = rangoSemana(undefined, semana)
  return fecha >= desde && fecha <= hasta
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
  const diaHoy = (new Date().getDay()) as DiaKey

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
      else toast({ title: status === 'approved' ? 'Aprobado por el cliente' : 'No aprobado' })
      setPendingId(null)
    })
  }

  const semanaIdeas = useMemo(
    () => ideas.filter((i) => i.status !== 'descartada' && enEstaSemana(i, 0) && ideaTieneEditadoEntregas(i)),
    [ideas],
  )

  return (
    <div className="space-y-4" data-testid="recibo-board">
      <header className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Bot className="h-5 w-5 text-violet-400" aria-hidden="true" />
            Recibo
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Clientes en modo AI: sube el video ya editado a Entregas (no toca el crudo del Pipeline),
            marca a mano si se posteó y si el cliente aprobó, y manda el enlace de aprobación.
            Sin auto-post a Metricool.
          </p>
        </div>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium">
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
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          No hay clientes con modo de edición <strong>AI</strong>. Actívalo en el perfil del cliente
          (Resumen → Modo de edición).
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Subir video editado</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Mismo flujo de Entregas R2. No sobrescribe footage crudo del Pipeline.
            </p>
            <EditorSubmitSlot clients={aiClients.map((c) => ({ id: c.id, name: c.name }))} dia={diaHoy} />
          </section>

          <section className="rounded-xl border border-border bg-card/60 px-4 py-3">
            <h2 className="mb-2 text-sm font-semibold">Enviar al cliente · esta semana</h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Elige videos de esta semana y genera un enlace bonito en{' '}
              <code className="rounded bg-muted px-1">/aprobacion</code>. Sin auto-post.
            </p>
            <EnviarAlCliente ideas={semanaIdeas.length ? semanaIdeas : ideas} />
          </section>

          <ul className="space-y-4">
            {byClient.map(({ client, ideas: clientIdeas }) => (
              <li key={client.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <ClientLogo name={client.name} logoUrl={client.logo_url} className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{client.name}</span>
                      <span
                        data-testid="recibo-ai-badge"
                        className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300"
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
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                    Sube un corte editado arriba para empezar.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {clientIdeas.map((idea) => {
                      const busy = isPending && pendingId === idea.id
                      const posted = idea.manual_posted_status
                      const approval = idea.staff_client_approval
                      const hasEdit = ideaTieneEditadoEntregas(idea)
                      return (
                        <li key={idea.id} className="space-y-3 px-4 py-3" data-testid={`recibo-idea-${idea.id}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {idea.title?.trim() || idea.hook?.trim() || 'Sin título'}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {idea.publish_date ? `Publicación ${idea.publish_date}` : 'Sin fecha de publicación'}
                                {hasEdit ? ' · Editado en Entregas' : ' · Sin archivo editado'}
                              </p>
                            </div>
                            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Publicación
                              </p>
                              <div className="flex flex-wrap gap-1.5">
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
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Cliente
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                <ToggleBtn
                                  active={approval === 'approved'}
                                  disabled={busy}
                                  onClick={() => markApproval(idea.id, 'approved')}
                                  tone="ok"
                                  label="Aprobado por el cliente"
                                  icon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                />
                                <ToggleBtn
                                  active={approval === 'rejected'}
                                  disabled={busy}
                                  onClick={() => markApproval(idea.id, 'rejected')}
                                  tone="warn"
                                  label="No aprobado"
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
  icon,
  tone,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  icon: ReactNode
  tone: 'ok' | 'warn'
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold transition',
        active && tone === 'ok' && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
        active && tone === 'warn' && 'border-amber-500/50 bg-amber-500/15 text-amber-200',
        !active && 'border-border bg-background text-muted-foreground hover:bg-muted/50',
        disabled && 'opacity-50',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
