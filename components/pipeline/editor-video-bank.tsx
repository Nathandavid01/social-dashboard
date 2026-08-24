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
import type { EditorBankFile, EditorBankRow } from '@/lib/pipeline/editor-video-bank'

export function EditorVideoBank({ rows }: { rows: EditorBankRow[] }) {
  const canSetLogo = useHasPermission('clients.brand.edit')

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-16 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          No hay crudos listos en tu banco. Cuando On Site suba el material asignado, aparece aquí para verlo y bajarlo.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {rows.map((row) => (
        <section
          key={row.editorId ?? 'unassigned'}
          data-testid="editor-bank-row"
          className="rounded-xl border border-border bg-card"
        >
          <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-400">
                <UserRound className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">{row.editorName}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {row.clients.length} {row.clients.length === 1 ? 'cliente' : 'clientes'}
                </p>
              </div>
            </div>
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
                  <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground" data-testid="approved-count">
                    <span className="font-semibold text-foreground">{client.approvedCount}</span>{' '}
                    {client.approvedCount === 1 ? 'aprobado' : 'aprobados'}
                  </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border mx-3 mb-3">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Idea</th>
                        <th className="px-3 py-2 font-semibold">Archivo</th>
                        <th className="px-3 py-2 font-semibold">Notas</th>
                        <th className="px-3 py-2 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.clips.flatMap((clip) => {
                        if (clip.queue === 'waiting' || clip.files.length === 0) {
                          return [(
                            <tr key={clip.ideaId} className="border-t border-border/80 text-muted-foreground">
                              <td className="max-w-[160px] px-3 py-2 align-top font-medium">{clip.title}</td>
                              <td className="px-3 py-2 align-top">En espera</td>
                              <td className="max-w-[220px] px-3 py-2 align-top">{clip.shootingNotes ?? '—'}</td>
                              <td className="px-3 py-2 align-top text-right text-[11px]">Cola</td>
                            </tr>
                          )]
                        }
                        return clip.files.map((file, idx) => (
                          <tr key={file.id} className="border-t border-border/80">
                            <td className="max-w-[160px] px-3 py-2 align-top">
                              {idx === 0 ? <span className="font-medium text-foreground">{clip.title}</span> : null}
                            </td>
                            <td className="max-w-[180px] px-3 py-2 align-top">
                              <span className="block truncate">{file.name}</span>
                              <span className="text-[10px] uppercase text-muted-foreground">
                                {file.kind === 'broll' ? 'B-roll' : 'Crudo'}
                              </span>
                            </td>
                            <td className="max-w-[220px] px-3 py-2 align-top text-muted-foreground">
                              {idx === 0 ? (clip.shootingNotes ?? '—') : null}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <BankFileActions file={file} />
                            </td>
                          </tr>
                        ))
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
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
