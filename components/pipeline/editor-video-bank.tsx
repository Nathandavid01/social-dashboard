'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Camera, Download, ExternalLink, Loader2, Play, UserRound, Video, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientLogo } from '@/components/clients/client-logo'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { getR2DownloadUrl } from '@/lib/actions/idea-videos-r2'
import { getVideoPreviewUrl } from '@/lib/actions/video-preview'
import { EDITOR_WIP_LIMIT, type BankAdmin, type EditorBankClip, type EditorBankFile, type EditorBankRow } from '@/lib/pipeline/editor-video-bank'
import { deadlineStatus, deadlineTone, formatDateShortES } from '@/lib/utils/deadlines'

export function EditorVideoBank({ rows, admins = [] }: { rows: EditorBankRow[]; admins?: BankAdmin[] }) {
  const canSetLogo = useHasPermission('clients.brand.edit')
  const canOpenProfile = useHasPermission('team.read')

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <article
              key={`load-${row.editorId ?? 'unassigned'}`}
              data-testid={`editor-load-${row.editorId ?? 'unassigned'}`}
              className="rounded-xl border border-border bg-card p-4"
            >
              <EditorIdentity
                editorId={row.editorId}
                editorName={row.editorName}
                clientCount={row.clients.length}
                canOpenProfile={canOpenProfile}
                className="mb-3"
                profileTestId
              />
              <div className="grid grid-cols-3 gap-2">
                <LoadStat label="Ahora" value={`${row.nowCount}/${EDITOR_WIP_LIMIT}`} hint="espacios" hot={row.nowCount >= EDITOR_WIP_LIMIT} />
                <LoadStat label="Banco" value={row.remainingInBank} hint="pendientes" />
                <LoadStat label="Revisión" value={row.inRevision} hint="en corte" />
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {row.clients.map((client) => (
                  <li
                    key={client.clientId}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
                    style={{ borderColor: `${client.cardColor}66`, background: `${client.cardColor}14` }}
                  >
                    <span className="truncate font-medium">{client.clientName}</span>
                    <span className="tabular-nums text-muted-foreground">{client.remainingInBank}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
      {admins.length > 0 && (
        <section data-testid="bank-admins" className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Admins</h2>
            <p className="text-[11px] text-muted-foreground">Owner y supervisor — quién opera este banco</p>
          </header>
          <ul className="divide-y divide-border">
            {admins.map((admin) => (
              <li key={admin.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{admin.name}</p>
                  {admin.email && (
                    <p className="truncate text-[11px] text-muted-foreground">{admin.email}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {admin.roleLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.length === 0 ? (
        <div className="flex items-center justify-center px-5 py-16 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            No hay crudos listos en tu banco. Cuando On Site suba el material asignado, aparece aquí para verlo y bajarlo.
          </p>
        </div>
      ) : rows.map((row) => (
        <section
          key={row.editorId ?? 'unassigned'}
          data-testid="editor-bank-row"
          className="rounded-xl border border-border bg-card"
        >
          <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3">
            <EditorIdentity
              editorId={row.editorId}
              editorName={row.editorName}
              clientCount={row.clients.length}
              canOpenProfile={canOpenProfile}
              heading
            />
          </header>
          <div className="space-y-4 p-3 sm:p-4">
            {row.clients.map((client) => (
              <div
                key={client.clientId}
                data-testid="client-bank-card"
                className="min-w-0 overflow-hidden rounded-lg border bg-card/40"
                style={{
                  borderColor: client.cardColor,
                  boxShadow: `inset 3px 0 0 0 ${client.cardColor}`,
                  background: `linear-gradient(90deg, ${client.cardColor}14, transparent 42%)`,
                }}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pt-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <ClientLogo name={client.clientName} logoUrl={client.logoUrl} className="h-6 w-6 text-[9px]" />
                    <h3 className="truncate text-[13px] font-semibold">{client.clientName}</h3>
                    {!client.logoUrl && canSetLogo && (
                      <Link
                        href={`/clients/${client.clientId}`}
                        className="shrink-0 text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      >
                        Subir logo
                      </Link>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] tabular-nums text-muted-foreground" data-testid="approved-count">
                      <span className="font-semibold text-foreground">{client.remainingInBank}</span> en banco
                      {' · '}
                      <span className="font-semibold text-foreground">{client.inRevision}</span> revisión
                      {' · '}
                      <span className="font-semibold text-foreground">{client.approvedCount}</span>{' '}
                      {client.approvedCount === 1 ? 'aprobado' : 'aprobados'}
                    </p>
                    {client.postingDays.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Publica {formatPostingDays(client.postingDays)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2 px-3 pb-3">
                  {client.clips.map((clip) => (
                    <ClipDocument key={clip.ideaId} clip={clip} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function EditorIdentity({
  editorId,
  editorName,
  clientCount,
  canOpenProfile,
  heading = false,
  className,
  profileTestId = false,
}: {
  editorId: string | null
  editorName: string
  clientCount: number
  canOpenProfile: boolean
  heading?: boolean
  className?: string
  profileTestId?: boolean
}) {
  const NameTag = heading ? 'h2' : 'p'
  const inner = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-400">
        <UserRound className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <NameTag className="truncate text-sm font-semibold">{editorName}</NameTag>
        <p className="text-[11px] text-muted-foreground">
          {clientCount} {clientCount === 1 ? 'cliente' : 'clientes'}
        </p>
      </div>
    </>
  )
  const wrapClass = `flex min-w-0 items-center gap-2 ${className ?? ''}`
  if (canOpenProfile && editorId) {
    return (
      <Link
        href={`/team/${editorId}`}
        data-testid={profileTestId ? `editor-profile-${editorId}` : undefined}
        className={`${wrapClass} rounded-lg pr-2 transition-colors hover:bg-muted/50`}
        aria-label={`Historial de ${editorName}`}
      >
        {inner}
      </Link>
    )
  }
  return <div className={wrapClass}>{inner}</div>
}

const POSTING_DAY = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function formatPostingDays(days: number[]): string {
  return days
    .map((d) => (d === 0 ? 'Dom' : POSTING_DAY[d] ?? ''))
    .filter(Boolean)
    .join(' · ')
}

function ClipDocument({ clip }: { clip: EditorBankClip }) {
  const waiting = clip.queue === 'waiting' || clip.files.length === 0
  const tone = deadlineTone(deadlineStatus(clip.deadline, waiting ? 'grabada' : 'grabada'))
  return (
    <article
      data-testid="bank-clip"
      className={`rounded-lg border px-3 py-2.5 ${waiting ? 'border-border/70 bg-muted/20 text-muted-foreground' : 'border-border bg-background/60'}`}
    >
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {clip.yours && (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                Te toca
              </span>
            )}
            {waiting && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                En espera
              </span>
            )}
            {clip.contentType && (
              <span className="text-[10px] font-medium uppercase text-muted-foreground">{clip.contentType}</span>
            )}
            <h4 className="text-[13px] font-semibold text-foreground">{clip.title}</h4>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {clip.recordedBy ? `Grabó ${clip.recordedBy}` : 'Sin log de grabación'}
            {clip.location ? ` · ${clip.location}` : ''}
            {clip.deadline ? ` · límite ${formatDateShortES(clip.deadline)}` : ''}
          </p>
        </div>
        {tone.label && (
          <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${tone.className}`}>
            {tone.label}
          </span>
        )}
      </div>
      {clip.hook && (
        <p className="text-[11px] leading-snug text-foreground/90">
          <span className="font-medium text-muted-foreground">Guión · </span>
          {clip.hook}
        </p>
      )}
      {clip.visualBrief && (
        <p className="mt-1 text-[11px] leading-snug text-foreground/80">
          <span className="font-medium text-muted-foreground">Qué grabar · </span>
          {clip.visualBrief}
        </p>
      )}
      {clip.shootingNotes && (
        <p className="mt-1 text-[11px] leading-snug">
          <span className="font-medium text-muted-foreground">Anotaciones · </span>
          {clip.shootingNotes}
        </p>
      )}
      <div className="mt-2 flex flex-col gap-2">
        {waiting ? (
          <p className="text-[11px]">Cola — entra cuando se libere un espacio</p>
        ) : (
          clip.files.map((file) => (
            <div key={file.id} className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[11px]">
                {file.name}
                <span className="ml-1 uppercase text-muted-foreground">{file.kind === 'broll' ? 'B-roll' : 'Crudo'}</span>
              </p>
              <BankFileActions file={file} />
            </div>
          ))
        )}
      </div>
    </article>
  )
}

function LoadStat({
  label,
  value,
  hint,
  hot,
}: {
  label: string
  value: number | string
  hint: string
  hot?: boolean
}) {
  return (
    <div className={`rounded-lg border px-2 py-2 text-center ${hot ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-muted/30'}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums leading-tight text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function BankFileActions({ file }: { file: EditorBankFile }) {
  const { toast } = useToast()
  const isR2 = file.storageProvider === 'r2'
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const Icon = file.kind === 'broll' ? Video : Camera

  async function download() {
    if (!isR2) {
      if (file.driveViewLink) window.open(file.driveViewLink, '_blank')
      return
    }
    const res = await getR2DownloadUrl(file.id)
    if (res.error || !res.url) {
      toast({ title: 'Error', description: res.error ?? 'No se pudo descargar', variant: 'destructive' })
    } else {
      window.open(res.url, '_blank')
    }
  }

  async function togglePreview() {
    if (previewUrl) { setPreviewUrl(null); return }
    setLoading(true)
    const res = await getVideoPreviewUrl(file.id)
    setLoading(false)
    if (res.error || !res.url) {
      toast({ title: 'Error', description: res.error ?? 'No se pudo cargar', variant: 'destructive' })
    } else {
      setPreviewUrl(res.url)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center justify-end gap-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {isR2 && (
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={togglePreview} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : previewUrl ? <X className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className="ml-1 hidden sm:inline">{previewUrl ? 'Cerrar' : 'Ver'}</span>
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={download}>
          {isR2 ? <Download className="mr-1 h-3.5 w-3.5" /> : <ExternalLink className="mr-1 h-3.5 w-3.5" />}
          Bajar
        </Button>
      </div>
      {previewUrl && (
        <video src={previewUrl} controls playsInline className="aspect-video w-full max-w-sm rounded-md border bg-black" />
      )}
    </div>
  )
}
