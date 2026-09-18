'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, Image as ImageIcon, Upload, Video } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { putBankFile } from '@/components/clients/put-bank-file'
import { getClientAssetDownloadUrl } from '@/lib/actions/client-asset-bank'
import {
  BANK_KIND_LABELS,
  BANK_KINDS,
  type BankAssetKind,
  type ClientBankFile,
} from '@/lib/utils/client-asset-bank'
import { cn } from '@/lib/utils'

const ACCEPT: Record<BankAssetKind, string> = {
  logo: 'image/*',
  photo: 'image/*',
  broll: 'video/*',
  other: '*/*',
}

function formatBytes(n: number | null): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function ClientAssetBankPanel({
  clientId,
  clientName,
  assets,
  canUpload,
}: {
  clientId: string
  clientName: string
  assets: ClientBankFile[]
  canUpload: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<BankAssetKind>('photo')
  const [pending, startTransition] = useTransition()
  const [downloading, setDownloading] = useState<string | null>(null)

  function pickFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return
    startTransition(async () => {
      let failed = 0
      for (const file of list) {
        const res = await putBankFile({ clientId, kind, file })
        if (res.error) {
          failed += 1
          toast({ title: 'No se pudo subir', description: res.error, variant: 'destructive' })
        }
      }
      if (failed < list.length) {
        toast({
          title: list.length - failed === 1 ? 'Archivo en el banco' : `${list.length - failed} archivos en el banco`,
          description: `Quedan en el banco de ${clientName}. No se mezclan con los crudos de la toma.`,
        })
        router.refresh()
      }
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  async function download(asset: ClientBankFile) {
    setDownloading(asset.id)
    try {
      const res = await getClientAssetDownloadUrl(asset.id)
      if (!res.url) throw new Error(res.error || 'Archivo no disponible')
      const a = document.createElement('a')
      a.href = res.url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.download = asset.name
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      toast({
        title: 'No se pudo descargar',
        description: err instanceof Error ? err.message : 'Archivo no disponible',
        variant: 'destructive',
      })
    } finally {
      setDownloading(null)
    }
  }

  return (
    <section
      data-testid="client-asset-bank"
      className="rounded-2xl border border-primary/30 bg-card p-3 sm:p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Banco del cliente</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Logos, fotos, B-roll y otros de {clientName}. Se quedan aquí, no en una idea.
          </p>
        </div>
        <FolderOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      </header>

      {canUpload && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BANK_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'min-h-11 rounded-lg border px-3 text-sm font-medium',
                  kind === k
                    ? 'border-primary bg-primary/15 text-foreground'
                    : 'border-border text-muted-foreground',
                )}
              >
                {BANK_KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="sr-only">Subir al banco</span>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT[kind]}
              aria-label="Subir al banco"
              disabled={pending}
              onChange={(e) => {
                pickFiles(e.target.files ?? [])
              }}
              className="block w-full min-w-0 text-xs file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:text-xs file:font-semibold file:text-primary-foreground"
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            {pending ? 'Subiendo…' : `Categoría: ${BANK_KIND_LABELS[kind]}. No se publica solo.`}
          </p>
        </div>
      )}

      {assets.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Todavía no hay archivos en el banco de {clientName}.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {assets.map((asset) => (
            <li key={asset.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2">
              {asset.kind === 'broll' ? (
                <Video className="h-4 w-4 shrink-0 text-teal-400" aria-hidden />
              ) : (
                <ImageIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{asset.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {BANK_KIND_LABELS[asset.kind]}
                  {asset.sizeBytes ? ` · ${formatBytes(asset.sizeBytes)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void download(asset)}
                disabled={downloading === asset.id}
                className="shrink-0 text-xs font-medium text-primary underline"
              >
                {downloading === asset.id ? 'Bajando…' : 'Descargar'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Upload className="h-3 w-3" /> Los crudos de cada toma se suben aparte, abajo.
        </p>
      )}
    </section>
  )
}
