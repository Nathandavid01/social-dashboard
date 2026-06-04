'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, LayoutGrid, Lightbulb, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlatformBadges } from '@/components/clients/platform-badges'
import { cn } from '@/lib/utils'
import {
  batchHint,
  buildStepper,
  cardStatus,
  type BatchVideo,
} from '@/lib/utils/batch-view'
import type { ClientVideoPipeline } from '@/lib/actions/video-pipeline'
import { BatchStepper } from './batch-stepper'
import { BatchVideoCard } from './batch-video-card'
import { BatchVideoDetail } from './batch-video-detail'

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  active: { label: 'Activo', tone: 'bg-emerald-500/10 text-emerald-500' },
  paused: { label: 'Pausado', tone: 'bg-amber-500/10 text-amber-500' },
  inactive: { label: 'Inactivo', tone: 'bg-muted text-muted-foreground' },
  archived: { label: 'Archivado', tone: 'bg-muted text-muted-foreground' },
}

function durationLabel(v: BatchVideo): string | null {
  const sec = v.videos.raw[0]?.duration_sec ?? v.videos.edited[0]?.duration_sec ?? null
  if (!sec) return null
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ClientBatchView({ pipeline }: { pipeline: ClientVideoPipeline }) {
  const { client } = pipeline
  const videos = pipeline.videos as BatchVideo[]

  const stepper = useMemo(() => buildStepper(videos), [videos])
  const hint = useMemo(() => batchHint(videos), [videos])
  const pendientes = useMemo(
    () => videos.filter((v) => cardStatus(v).key === 'por_grabar').length,
    [videos],
  )

  const [selectedId, setSelectedId] = useState<string | null>(videos[0]?.id ?? null)
  const selected = videos.find((v) => v.id === selectedId) ?? null

  const status = STATUS_LABEL[client.status] ?? {
    label: client.status,
    tone: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="flex flex-col">
      {/* topbar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3.5">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/clients/${client.id}`}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
            Clientes
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-semibold text-foreground">{client.name}</span>
        </div>
        <Button asChild variant="secondary" size="sm" className="gap-1.5">
          <Link href={`/clients/${client.id}?tab=flujo`}>
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            Ver tablero
          </Link>
        </Button>
      </div>

      {/* hero */}
      <div className="flex flex-col gap-4 border-b border-border px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo_url}
              alt={client.name}
              className="h-13 w-13 rounded-xl object-cover"
              style={{ height: 52, width: 52 }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-sm font-bold text-background"
              style={{ height: 52, width: 52 }}
            >
              {client.name.slice(0, 3).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-foreground md:text-2xl">{client.name}</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  status.tone,
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {status.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {client.industry && <span>{client.industry}</span>}
              {client.platforms?.length > 0 && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <PlatformBadges platforms={client.platforms} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* batch summary */}
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              Lote
            </span>
            <span className="text-sm font-semibold text-foreground">Lote actual</span>
          </div>
          <div className="h-7 w-px bg-border" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              Videos
            </span>
            <span className="text-sm font-semibold text-foreground">
              {videos.length} {videos.length === 1 ? 'video' : 'videos'}
            </span>
          </div>
          <div className="h-7 w-px bg-border" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              Por grabar
            </span>
            <span className="text-sm font-semibold text-foreground">{pendientes}</span>
          </div>
        </div>
      </div>

      {/* stepper */}
      <div className="border-b border-border px-6 py-5">
        <BatchStepper stages={stepper} />
      </div>

      {/* guidance banner */}
      <div className="px-6 py-3.5">
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/[0.06] px-3.5 py-3">
          <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
          </span>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-foreground">
              Este lote está en la etapa {hint.stageLabel}
            </span>
            <span className="text-xs text-muted-foreground">{hint.tip}</span>
          </div>
        </div>
      </div>

      {/* body: videos + detail */}
      <div className="flex flex-col gap-5 px-6 pb-6 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Videos de este lote</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {videos.length}
              </span>
            </div>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nuevo video
            </Button>
          </div>

          {videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
              </span>
              <p className="text-sm font-medium text-foreground">Este lote aún no tiene videos</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Crea el primer video para empezar a trabajar el contenido de {client.name}.
              </p>
              <Button size="sm" className="mt-1 gap-1.5">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Nuevo video
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {videos.map((v, i) => (
                <BatchVideoCard
                  key={v.id}
                  video={v}
                  accentIndex={i}
                  selected={v.id === selectedId}
                  durationLabel={durationLabel(v)}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          )}
        </div>

        {videos.length > 0 && (
          <div className="w-full shrink-0 lg:sticky lg:top-4 lg:w-[560px]">
            <BatchVideoDetail video={selected} />
          </div>
        )}
      </div>
    </div>
  )
}
