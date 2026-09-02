'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Download, ExternalLink, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientLogo } from '@/components/clients/client-logo'
import { VideoCover } from '@/components/recording/video-cover'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { reassignVideo } from '@/lib/actions/content-ideas'
import { getR2DownloadUrl } from '@/lib/actions/idea-videos-r2'
import type { BankAdmin, EditorBankClip, EditorBankFile, EditorBankRow } from '@/lib/pipeline/editor-video-bank'
import type { GlobalBrollGroup } from '@/lib/pipeline/global-broll'
import { approvalTone } from '@/lib/pipeline/approval-tone'
import { GlobalBrollSection } from './global-broll-section'
import { estimateDaysForEditor, teamMedianDays, type EditorPace } from '@/lib/pipeline/editor-pace'
import type { BankVideoTile, VideoBank } from '@/lib/pipeline/video-bank'
import type { Runway, RunwayStatus } from '@/lib/utils/content-runway'
import { formatDateShortES } from '@/lib/utils/deadlines'
import { approvalTargetText } from '@/lib/utils/approval-target'

type TeamMember = { id: string; name: string }

export function EditorVideoBank({
  rows,
  admins = [],
  videoBank,
  paces = [],
  teamMembers = [],
  clientRunway = {},
  globalBroll = [],
}: {
  rows: EditorBankRow[]
  admins?: BankAdmin[]
  videoBank?: VideoBank
  paces?: EditorPace[]
  teamMembers?: TeamMember[]
  clientRunway?: Record<string, Runway>
  globalBroll?: GlobalBrollGroup[]
}) {
  const canOpenProfile = useHasPermission('team.read')
  const teamPace = teamMedianDays(paces)
  const paceByEditor = useMemo(() => new Map(paces.map((pace) => [pace.editorId, pace])), [paces])

  return (
    <div className="flex-1 space-y-8 overflow-y-auto bg-[#0b0d0f] p-3 text-foreground sm:p-5">
      <section aria-labelledby="editor-spaces-title">
        <SectionHeader id="editor-spaces-title" title="Espacios de edición" description="El tope de videos activos sube con el % de aprobación de cada editor (2 → 3 → 4). Los espacios libres dejan claro quién puede tomar el próximo crudo." />
        {rows.length === 0 ? <EmptyState text="No hay crudos listos. Cuando On Site suba material, aparecerá aquí." /> : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {rows.map((row) => <EditorWorkCard key={row.editorId ?? 'unassigned'} row={row} pace={row.editorId ? paceByEditor.get(row.editorId) : undefined} teamPace={teamPace} canOpenProfile={canOpenProfile} showClientMarks={!videoBank} />)}
          </div>
        )}
      </section>
      {videoBank && <VideoBankLibrary bank={videoBank} teamMembers={teamMembers} clientRunway={clientRunway} />}
      <GlobalBrollSection groups={globalBroll} />
      {paces.length > 0 && <EditorPaceTable rows={rows} paces={paces} teamMembers={teamMembers} />}
      {admins.length > 0 && <AdminStrip admins={admins} />}
    </div>
  )
}

function SectionHeader({ id, title, description }: { id: string; title: string; description: string }) {
  return <header className="mb-3 border-b border-white/10 pb-3"><h2 id={id} className="text-sm font-semibold tracking-tight text-white">{title}</h2><p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-400">{description}</p></header>
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/10 px-5 py-12 text-center text-sm text-slate-500">{text}</div>
}

function EditorWorkCard({ row, pace, teamPace, canOpenProfile, showClientMarks }: { row: EditorBankRow; pace?: EditorPace; teamPace: number | null; canOpenProfile: boolean; showClientMarks: boolean }) {
  const canSetLogo = useHasPermission('clients.brand.edit')
  const active = row.clients.flatMap((client) => client.clips.map((clip) => ({ client, clip }))).filter(({ clip }) => clip.queue === 'active').slice(0, row.wipLimit)
  const waiting = row.clients.flatMap((client) => client.clips.map((clip) => ({ client, clip }))).filter(({ clip }) => clip.queue === 'waiting')
  const estimate = estimateDaysForEditor(pace, { teamMedianDays: teamPace })
  const approved = row.clients.reduce((sum, client) => sum + client.approvedCount, 0)

  return (
    <article data-testid={`editor-load-${row.editorId ?? 'unassigned'}`} className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#12161a] shadow-[0_12px_30px_rgba(0,0,0,.18)]">
      <span className="sr-only">Ahora {row.nowCount} de {row.wipLimit} · Banco {row.remainingInBank} · Revisión {row.inRevision}</span>
      <div className="flex flex-wrap items-start justify-between gap-2 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <EditorIdentity editorId={row.editorId} editorName={row.editorName} clientCount={row.clients.length} canOpenProfile={canOpenProfile} profileTestId />
          {row.approvalRate != null && (
            <span
              data-testid={`approval-rate-${row.editorId ?? 'unassigned'}`}
              className={`shrink-0 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${approvalTone(row.approvalRate).badge}`}
            >
              {row.approvalRate}% aprobación
            </span>
          )}
        </div>
        <div className="text-right text-[10px] text-slate-500">
          <p>{pace?.medianDays != null ? <>Ritmo <span className="font-semibold text-slate-200">{pace.medianDays} d</span> por video</> : 'Ritmo sin historial'}</p>
          <p className={row.nowCount >= row.wipLimit ? 'text-rose-300' : 'text-[#c8a34a]'}>{row.nowCount >= row.wipLimit ? `${row.wipLimit} de ${row.wipLimit}` : `${row.wipLimit - row.nowCount} ${row.wipLimit - row.nowCount === 1 ? 'espacio libre' : 'espacios libres'}`}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-3.5 pb-3">
        {Array.from({ length: row.wipLimit }).map((_, index) => {
          const work = active[index]
          return work ? <ActiveEditorSlot key={work.clip.ideaId} testId={`editor-slot-${row.editorId ?? 'unassigned'}-${index}`} client={work.client} clip={work.clip} estimate={estimate} showClientMark={showClientMarks} /> : (
            <div key={`free-${index}`} data-testid={`editor-slot-${row.editorId ?? 'unassigned'}-${index}`} className="grid min-h-36 place-items-center rounded-lg border border-dashed border-white/10 bg-black/10 px-3 text-center"><div><p className="text-[11px] font-medium text-slate-300">Espacio libre</p><p className="mt-1 text-[9px] text-slate-500">Puede tomar un video del banco</p><span className="mt-2 inline-block text-[10px] font-semibold text-[#c8a34a]">Disponible</span></div></div>
          )
        })}
      </div>
      {waiting.length > 0 && <div className="mx-3.5 mb-3 rounded-lg border border-[#c8a34a]/20 bg-[#c8a34a]/[0.04] p-2.5"><p className="text-[9px] uppercase tracking-[.14em] text-[#c8a34a]">Siguiente cuando libere</p><div className="mt-1.5 space-y-1.5">{waiting.slice(0, 3).map(({ client, clip }) => <div key={clip.ideaId} className="flex min-w-0 items-center gap-2 text-[10px]">{showClientMarks && <ClientLogo name={client.clientName} logoUrl={client.logoUrl} className="h-6 w-6 text-[8px]" />}<div className="min-w-0 flex-1"><p className="truncate text-slate-300">{clip.title}</p><p className="truncate text-[9px] text-slate-500">{client.clientName} · En espera</p></div>{showClientMarks && !client.logoUrl && canSetLogo && <Link href={`/clients/${client.clientId}`} className="shrink-0 text-[9px] text-[#c8a34a] underline underline-offset-2">Subir logo</Link>}</div>)}</div></div>}
      <footer className="flex items-center justify-between border-t border-white/10 px-3.5 py-2 text-[10px] text-slate-500"><span>{row.remainingInBank} en banco · {row.inRevision} en revisión</span><span data-testid="approved-count">{approved} {approved === 1 ? 'aprobado' : 'aprobados'}</span></footer>
    </article>
  )
}

function ActiveEditorSlot({ testId, client, clip, estimate, showClientMark }: { testId: string; client: EditorBankRow['clients'][number]; clip: EditorBankClip; estimate: number | null; showClientMark: boolean }) {
  const canSetLogo = useHasPermission('clients.brand.edit')
  const file = clip.files[0]
  const elapsed = daysSince(clip.recordedAt)
  return (
    <article data-testid={testId} className="group min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0d1013]" style={{ borderColor: `${client.cardColor}66` }}>
      <div data-testid="client-bank-card" className="relative min-h-24 overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-800 to-slate-950" style={{ borderColor: client.cardColor }}>
        {file ? <VideoCover videoId={file.id} title={clip.title} /> : null}
        <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1 py-0.5 text-[8px] uppercase text-slate-200">{file?.kind === 'broll' ? 'B-roll' : 'Crudo'}</span>
      </div>
      <div className="min-w-0 p-2">
        <div className="flex min-w-0 items-center gap-1.5">{showClientMark && <ClientLogo name={client.clientName} logoUrl={client.logoUrl} className="h-5 w-5 text-[7px]" />}<h3 className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white">{client.clientName}</h3>{showClientMark && !client.logoUrl && canSetLogo && <Link href={`/clients/${client.clientId}`} className="shrink-0 text-[8px] text-[#c8a34a] underline underline-offset-2">Subir logo</Link>}</div>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-300">{clip.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[9px] text-slate-500"><span className="rounded bg-[#c8a34a]/15 px-1 py-0.5 font-semibold uppercase text-[#d6b55f]">Te toca</span>{elapsed != null && <span>Día {elapsed}{estimate != null ? ` de ~${Math.max(1, Math.round(estimate))}` : ''}</span>}</div>
        <p data-testid="approval-target" className={`mt-1 text-[9px] ${clip.approvalAt ? 'text-[#d6b55f]' : 'text-rose-300'}`}>{approvalTargetText(clip.approvalAt)}</p>
        {clip.shootingNotes && <p className="mt-1 text-[9px] text-slate-500">Anotaciones · {clip.shootingNotes}</p>}
        {file && <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1"><span className="max-w-[8rem] truncate text-[9px] text-slate-500">{file.name}</span><BankFileActions file={file} compact /></div>}
      </div>
    </article>
  )
}

function VideoBankLibrary({ bank, teamMembers, clientRunway }: { bank: VideoBank; teamMembers: TeamMember[]; clientRunway: Record<string, Runway> }) {
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const rails = onlyUnassigned ? bank.rails.filter((rail) => !rail.editorId) : bank.rails
  return (
    <section aria-labelledby="raw-bank-title">
      <SectionHeader id="raw-bank-title" title="Banco de videos crudos" description="Cada crudo se ve como una carátula, agrupado por cliente y con el editor que lo tiene asignado." />
      <div className="mb-3 flex flex-wrap items-center gap-2"><button type="button" className="rounded-md border border-[#c8a34a]/40 bg-[#c8a34a]/10 px-2.5 py-1 text-[10px] font-medium text-[#d6b55f]">Por cliente</button><button type="button" aria-pressed={onlyUnassigned} onClick={() => setOnlyUnassigned((value) => !value)} className="rounded-md border border-white/10 px-2.5 py-1 text-[10px] text-slate-400 hover:text-white">Solo sin asignar {bank.totals.unassigned}</button><p className="ml-auto text-[10px] tabular-nums text-slate-500">{bank.totals.videos} crudos · {bank.totals.clients} clientes · {bank.totals.unassigned} sin editor</p></div>
      <div className="space-y-6">{rails.map((rail) => <section key={rail.clientId} className="min-w-0"><header className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: rail.cardColor }} /><ClientLogo name={rail.clientName} logoUrl={rail.logoUrl} className="h-6 w-6 text-[8px]" /><h3 className="truncate text-xs font-semibold text-white">{rail.clientName}</h3><ClientRunwayBadge clientId={rail.clientId} runway={clientRunway[rail.clientId]} /><span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400">{rail.videoCount} videos</span>{rail.postingDays.length > 0 && <span className="hidden text-[9px] text-[#c8a34a] sm:inline">Publica {formatPostingDays(rail.postingDays)}</span>}</div><p className="text-[9px] text-slate-500">{rail.editorName ? <>Le tocan a <span className="font-medium text-slate-300">{rail.editorName}</span></> : 'Sin editor asignado'}</p></header><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rail.videos.map((video) => <RawVideoCard key={video.videoId} video={video} teamMembers={teamMembers} color={rail.cardColor} />)}</div></section>)}</div>
    </section>
  )
}

const RUNWAY_TONE: Record<RunwayStatus, { label: string; className: string }> = {
  ok: { label: 'Adelantado', className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' },
  warn: { label: 'Atrasado', className: 'border-amber-400/25 bg-amber-400/10 text-amber-300' },
  risk: { label: 'Atrasado', className: 'border-rose-400/25 bg-rose-400/10 text-rose-300' },
  no_cadence: { label: 'Sin cadencia', className: 'border-white/10 bg-white/5 text-slate-400' },
}

function ClientRunwayBadge({ clientId, runway }: { clientId: string; runway?: Runway }) {
  if (!runway) return null
  const tone = RUNWAY_TONE[runway.status]
  const weeks = runway.minWeeks == null ? '' : ` · ${runway.minWeeks} sem`
  return <span data-testid={`client-runway-${clientId}`} title="Colchón de la etapa más débil contra la meta de 4 semanas" className={`rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${tone.className}`}>{tone.label}{weeks}</span>
}

function RawVideoCard({ video, teamMembers, color }: { video: BankVideoTile; teamMembers: TeamMember[]; color: string }) {
  const canAssign = useHasPermission('planning.assign')
  const { toast } = useToast()
  const [assigned, setAssigned] = useState(video.editorId ?? '')
  const [pending, startTransition] = useTransition()
  function changeEditor(editorId: string) {
    if (!video.productionTaskId) return
    const previous = assigned
    setAssigned(editorId)
    startTransition(async () => { const result = await reassignVideo(video.productionTaskId as string, editorId || null); if (result.error) { setAssigned(previous); toast({ title: 'No se pudo reasignar', description: result.error, variant: 'destructive' }) } })
  }
  return (
    <article data-testid={`raw-video-${video.videoId}`} className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#12161a]">
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-slate-800 to-black" style={{ boxShadow: `inset 0 2px 0 ${color}` }}><VideoCover videoId={video.videoId} title={video.title} /><span className="absolute right-1.5 top-1.5 rounded bg-black/75 px-1 py-0.5 text-[8px] font-semibold uppercase text-slate-200">{video.kind === 'broll' ? 'B-roll' : 'Crudo'}</span>{video.durationSec != null && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1 py-0.5 text-[9px] tabular-nums text-white">{formatDuration(video.durationSec)}</span>}</div>
      <div className="p-2.5"><h4 className="truncate text-[11px] font-semibold text-white" title={video.title}>{video.title}</h4><p className="mt-0.5 truncate text-[9px] text-slate-500">{video.recordedBy ? `Grabó ${video.recordedBy}` : 'Sin camarógrafo'}{video.uploadedAt ? ` · ${formatDateShortES(video.uploadedAt)}` : ''}</p><div className="mt-2 flex items-center gap-1.5"><VideoTileActions videoId={video.videoId} />{canAssign && video.productionTaskId ? <select aria-label={`Asignar ${video.title}`} value={assigned} disabled={pending} onChange={(event) => changeEditor(event.target.value)} className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-2 text-[9px] text-slate-300 outline-none focus:border-[#c8a34a]/60"><option value="">Sin editor</option>{teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select> : <span className="min-w-0 flex-1 truncate text-[9px] text-slate-500">{video.editorName ?? 'Sin editor'}</span>}</div></div>
    </article>
  )
}

function EditorPaceTable({ rows, paces, teamMembers }: { rows: EditorBankRow[]; paces: EditorPace[]; teamMembers: TeamMember[] }) {
  const names = new Map(teamMembers.map((member) => [member.id, member.name]))
  const rowById = new Map(rows.filter((row) => row.editorId).map((row) => [row.editorId as string, row]))
  const teamPace = teamMedianDays(paces)
  const max = Math.max(1, ...paces.map((pace) => pace.medianDays ?? 0))
  return (
    <section aria-labelledby="editor-pace-title"><SectionHeader id="editor-pace-title" title="Ritmo de los editores" description="Mediana de días desde que entra el crudo hasta que se entrega el corte, calculada con los últimos 30 días." /><div className="overflow-x-auto rounded-xl border border-white/10 bg-[#12161a]"><div className="min-w-[620px] divide-y divide-white/10">{paces.map((pace) => { const row = rowById.get(pace.editorId); const width = `${Math.max(8, ((pace.medianDays ?? 0) / max) * 100)}%`; const slow = teamPace != null && pace.medianDays != null && pace.medianDays > teamPace; return <div key={pace.editorId} data-testid={`editor-pace-${pace.editorId}`} className="grid grid-cols-[150px_1fr_72px_82px_78px] items-center gap-3 px-3 py-2.5 text-[10px]"><div className="min-w-0"><p className="truncate font-medium text-slate-200">{row?.editorName ?? names.get(pace.editorId) ?? 'Editor'}</p><p className="text-[9px] text-slate-500">{row?.clients.length ?? 0} clientes</p></div><div className="h-2 overflow-hidden rounded-full bg-black/30"><div className={`h-full rounded-full ${slow ? 'bg-rose-400/60' : 'bg-emerald-400/55'}`} style={{ width }} /></div><p className="text-right font-semibold tabular-nums text-slate-100">{pace.medianDays ?? '—'} d</p><p className="text-right tabular-nums text-slate-400">{pace.delivered} en 30 d</p><p className={`text-right tabular-nums ${pace.trendDays != null && pace.trendDays > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{pace.trendDays == null ? 'sin previo' : `${pace.trendDays > 0 ? '+' : ''}${pace.trendDays} d`}</p></div>})}</div></div>{teamPace != null && <p className="mt-2 text-right text-[9px] text-slate-500">Mediana del equipo: {teamPace} d</p>}</section>
  )
}

function AdminStrip({ admins }: { admins: BankAdmin[] }) {
  return <section data-testid="bank-admins" className="rounded-xl border border-white/10 bg-[#12161a]"><header className="border-b border-white/10 px-4 py-3"><h2 className="text-sm font-semibold">Admins</h2><p className="text-[11px] text-slate-500">Owner y supervisor · operación del banco</p></header><ul className="divide-y divide-white/10">{admins.map((admin) => <li key={admin.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium">{admin.name}</p>{admin.email && <p className="truncate text-[11px] text-slate-500">{admin.email}</p>}</div><span className="rounded border border-white/10 px-2 py-0.5 text-[10px] uppercase text-slate-400">{admin.roleLabel}</span></li>)}</ul></section>
}

function EditorIdentity({ editorId, editorName, clientCount, canOpenProfile, profileTestId = false }: { editorId: string | null; editorName: string; clientCount: number; canOpenProfile: boolean; profileTestId?: boolean }) {
  const initials = editorName.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()
  const inner = <><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-[9px] font-semibold text-slate-400">{editorId ? initials : <UserRound className="h-3.5 w-3.5" />}</span><div className="min-w-0"><h2 className="truncate text-xs font-semibold text-white">{editorName}</h2><p className="text-[9px] text-slate-500">{clientCount} {clientCount === 1 ? 'cliente' : 'clientes'}</p></div></>
  const className = 'flex min-w-0 items-center gap-2 rounded-lg pr-2'
  return canOpenProfile && editorId ? <Link href={`/team/${editorId}`} data-testid={profileTestId ? `editor-profile-${editorId}` : undefined} className={`${className} hover:bg-white/[0.03]`} aria-label={`Historial de ${editorName}`}>{inner}</Link> : <div className={className}>{inner}</div>
}

function VideoTileActions({ videoId }: { videoId: string }) {
  return <BankFileActions file={{ id: videoId, name: '', kind: 'raw', storageProvider: 'r2', driveViewLink: null }} compact />
}

function BankFileActions({ file, compact = false }: { file: EditorBankFile; compact?: boolean }) {
  const { toast } = useToast()
  const isR2 = file.storageProvider === 'r2'
  async function download() { if (!isR2) { if (file.driveViewLink) window.open(file.driveViewLink, '_blank'); return } const result = await getR2DownloadUrl(file.id); if (result.error || !result.url) toast({ title: 'Error', description: result.error ?? 'No se pudo descargar', variant: 'destructive' }); else window.open(result.url, '_blank') }
  return <Button size="sm" variant="ghost" className={compact ? 'h-7 w-7 p-0' : 'h-8 px-2 text-xs'} onClick={download} aria-label="Bajar">{isR2 ? <Download className="h-3 w-3" /> : <ExternalLink className="h-3 w-3" />}</Button>
}

const POSTING_DAY = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
function formatPostingDays(days: number[]): string { return days.map((day) => day === 0 ? 'Dom' : POSTING_DAY[day] ?? '').filter(Boolean).join(' · ') }
function formatDuration(seconds: number): string { const mins = Math.floor(seconds / 60); return `${mins}:${String(Math.round(seconds % 60)).padStart(2, '0')}` }
function daysSince(value: string | null): number | null { if (!value) return null; const time = Date.parse(value); if (!Number.isFinite(time)) return null; return Math.max(1, Math.floor((Date.now() - time) / 86_400_000) + 1) }
