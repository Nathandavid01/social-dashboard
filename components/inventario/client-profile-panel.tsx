'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useHasPermission } from '@/components/auth/role-gate'
import { ClientCadenceEditor } from '@/components/clients/cadence/client-cadence-editor'
import { CalendarClock, CheckCircle2, ExternalLink, Film, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClientStock } from '@/lib/inventario/video-stock-core'
import type { ClientStockDetail } from '@/lib/inventario/client-detail-types'
import type { DetailPost } from '@/lib/inventario/client-detail-core'
import type { Format } from '@/lib/inventario/cadence-formats'
import { ClientLogo } from './client-logo'
import { GOLD_HEX, HEALTH_META, RAW_HEX, daysLeftLabel, runOutLabel, shortDateLabel, timeLabel } from './stock-labels'

type Post = DetailPost & { coverUrl: string | null }

const CADENCE_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Same colors as the 3D calendar tiles. */
export const FORMAT_META: Record<Format, { label: string; plural: string; hex: string }> = {
  reel: { label: 'Reel', plural: 'Reels', hex: '#e6af23' },
  post: { label: 'Post', plural: 'Posts', hex: '#c4b5fd' },
  story: { label: 'Story', plural: 'Stories', hex: '#f9a8d4' },
}

const STAGE_META: Record<DetailPost['stage'], { label: string; icon: typeof Send; className: string }> = {
  agendado: { label: 'Agendado', icon: CalendarClock, className: 'text-[#e6af23]' },
  listo: { label: 'Listo', icon: Film, className: 'text-white' },
  publicado: { label: 'Publicado', icon: CheckCircle2, className: 'text-emerald-400' },
}

function postWhen(p: Post): string {
  const meta = STAGE_META[p.stage]
  if (!p.date) return p.stage === 'listo' ? 'Listo · sin día libre' : meta.label
  if (p.stage === 'listo') return `Listo · saldría ${shortDateLabel(p.date)}`
  return `${meta.label} · ${shortDateLabel(p.date)}`
}

function PostRow({ post }: { post: Post }) {
  const meta = STAGE_META[post.stage]
  const Icon = meta.icon
  return (
    <li data-testid="profile-post" data-post={post.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-gradient-to-b from-[#1d1d1d] to-black">
        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned R2 cover, short-lived URL
          <img src={post.coverUrl} alt={`Portada de ${post.title}`} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Film className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white/30" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white">{post.title}</div>
        <div className={cn('mt-0.5 flex items-center gap-1 text-xs', meta.className)}>
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{postWhen(post)}</span>
        </div>
      </div>
    </li>
  )
}

/**
 * The client's profile, shown when a medallion is selected: identity, the
 * inventory numbers, and every post on the next weeks of their calendar.
 * The 3D scene shows the same 14 days as a ribbon of tiles.
 */
export function ClientProfilePanel({
  client,
  today,
  detail,
  loading,
  error,
  onClose,
  onCadenceSaved,
}: {
  client: ClientStock
  today: string
  detail: ClientStockDetail | null
  loading: boolean
  error: string | null
  onClose: () => void
  /** The cadence was changed here: the page recomputes the inventory. */
  onCadenceSaved?: (clientId: string) => void
}) {
  const canEditCadence = useHasPermission('cadence.edit')
  const [editing, setEditing] = useState(false)
  const health = HEALTH_META[client.health]
  const empty = detail ? detail.calendar.filter((d) => d.kind === 'vacio').length : 0
  const posts: Post[] = detail ? [...detail.upcoming, ...detail.recent] : []

  return (
    <aside
      aria-label={`Perfil de ${client.clientName}`}
      className="animate-in fade-in slide-in-from-right-4 flex max-h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/80 text-white shadow-[0_20px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl duration-300"
    >
      <div className="relative shrink-0 p-4 pb-3">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-40"
          style={{ background: `radial-gradient(ellipse at top left, ${health.hex}, transparent 70%)` }}
        />
        <div className="relative flex items-start gap-3">
          <ClientLogo key={client.logoUrl ?? 'none'} name={client.clientName} src={client.logoUrl} ringHex={health.hex} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold leading-tight">{client.clientName}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/70">
              <span
                className="whitespace-nowrap rounded-full px-2 py-0.5 font-medium"
                style={{ backgroundColor: `${health.hex}26`, color: health.hex }}
              >
                {health.label}
              </span>
              <span className="whitespace-nowrap">{runOutLabel(client.runOutDate, today)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar perfil"
            className="shrink-0 rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-3 space-y-1.5 text-xs text-white/60">
          {detail && detail.profile.postingDays.length > 0 ? (
            <ul data-testid="profile-cadence" aria-label="Cadencia" className="flex flex-wrap gap-1.5">
              {CADENCE_ORDER.filter((d) => detail.profile.postingDays.includes(d)).map((d) => {
                const f = detail.profile.formats?.[d] ?? null
                return (
                  <li
                    key={d}
                    className="flex items-center gap-1 rounded-md border px-1.5 py-0.5"
                    style={{ borderColor: f ? `${FORMAT_META[f].hex}66` : 'rgba(255,255,255,0.15)' }}
                  >
                    <span className="font-semibold text-white">{DAY_SHORT[d]}</span>
                    <span style={{ color: f ? FORMAT_META[f].hex : 'rgba(255,255,255,0.5)' }}>{f ? FORMAT_META[f].label : 'Cualquiera'}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            !loading && <div>Sin cadencia</div>
          )}
          {detail && canEditCadence && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              aria-expanded={editing}
              className="rounded-md border border-[#e6af23]/40 px-2 py-0.5 text-[11px] font-medium text-[#e6af23] transition-colors hover:bg-[#e6af23]/10"
            >
              {editing ? 'Cerrar' : 'Editar cadencia'}
            </button>
          )}
          {detail && editing && (
            <div className="dark rounded-lg border border-white/10 bg-white/[0.04] p-2 text-foreground">
              <ClientCadenceEditor
                key={client.clientId}
                clientId={client.clientId}
                initialDays={detail.profile.postingDays}
                initialTime={detail.profile.postingTime}
                initialSchedule={detail.profile.postingSchedule}
                initialTimezone={detail.profile.postingTimezone}
                compact
                showTimezone={false}
                onSaved={() => {
                  setEditing(false)
                  onCadenceSaved?.(client.clientId)
                }}
              />
            </div>
          )}
          {detail && (
            <div>
              {[
                detail.profile.postingTime && `Publica ${timeLabel(detail.profile.postingTime)}`,
                detail.profile.editorName ? `Editor: ${detail.profile.editorName}` : 'Sin editor asignado',
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>

        <div className="relative mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            { id: 'profile-listos', value: client.listos, label: 'listos', color: GOLD_HEX },
            { id: 'profile-agendados', value: client.agendados, label: 'agendados', color: '#ffffff' },
            { id: 'profile-crudo', value: client.crudo, label: 'en crudo', color: RAW_HEX },
            { id: 'profile-dias', value: daysLeftLabel(client), label: 'alcanza', color: health.hex },
          ].map((s) => (
            <div key={s.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-1 py-2">
              <div data-testid={s.id} className="text-base font-bold tabular-nums leading-none" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="mt-1 text-[10px] text-white/50">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-white/10 p-4 pt-3">
        {loading && (
          <div data-testid="profile-loading" className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-lg bg-white/[0.06]" />
            ))}
          </div>
        )}
        {!loading && error && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            No se pudo cargar el perfil ({error}). Los números de arriba siguen siendo correctos.
          </p>
        )}
        {!loading && detail && (
          <>
            <p className={cn('mb-3 text-xs font-medium', empty > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {empty === 0
                ? 'Todos los días de publicación de las próximas 2 semanas tienen video'
                : `${empty === 1 ? '1 día' : `${empty} días`} sin video en las próximas 2 semanas`}
            </p>
            {posts.length === 0 ? (
              <p className="text-xs text-white/50">No tiene reels ni posts agendados, listos o publicados recientemente.</p>
            ) : (
              <div className="space-y-4">
                {(['reel', 'post'] as const).map((kind) => {
                  const list = posts.filter((p) => (kind === 'reel' ? p.format === 'reel' : p.format !== 'reel'))
                  const meta = FORMAT_META[kind]
                  const ready = list.filter((p) => p.stage === 'listo').length
                  return (
                    <section key={kind} aria-label={meta.plural}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: meta.hex }}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.hex }} />
                          {meta.plural}
                        </h4>
                        <span className="text-[11px] text-white/50">
                          {ready} {ready === 1 ? 'listo' : 'listos'}
                        </span>
                      </div>
                      {list.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-white/40">
                          Ninguno en camino.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {list.map((p) => (
                            <PostRow key={p.id} post={p} />
                          ))}
                        </ul>
                      )}
                    </section>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 p-3">
        <Link
          href={`/clients/${client.clientId}`}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#e6af23] px-3 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
        >
          Abrir cliente <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </aside>
  )
}
