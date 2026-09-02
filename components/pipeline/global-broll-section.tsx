'use client'

/**
 * B-roll y files globales: recursos reutilizables de TODOS los clientes,
 * visibles para cualquier editor que entre al banco (los crudos raw NO —
 * esos siguen scoped a la asignación). Colapsado por defecto para no
 * estorbar el trabajo asignado.
 */
import { useState } from 'react'
import { ChevronDown, Download, ExternalLink, Globe, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { getR2DownloadUrl } from '@/lib/actions/idea-videos-r2'
import type { GlobalBrollGroup } from '@/lib/pipeline/global-broll'
import { cn } from '@/lib/utils'

export function GlobalBrollSection({ groups }: { groups: GlobalBrollGroup[] }) {
  const [open, setOpen] = useState(false)
  const total = groups.reduce((n, g) => n + g.files.length, 0)
  if (total === 0) return null

  return (
    <section id="global-broll" data-testid="global-broll" className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-semibold">B-roll y files globales</span>
          <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {total}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-3 sm:p-4">
          <p className="text-[11px] text-muted-foreground">
            Recursos de todos los clientes, para reusar en cualquier edición. Los crudos asignados siguen en tu banco.
          </p>
          {groups.map((group) => (
            <div key={group.clientId}>
              <p className="mb-1 text-[12px] font-semibold text-muted-foreground">{group.clientName}</p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {group.files.map((file) => (
                  <BrollRow key={file.id} file={file} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function BrollRow({ file }: { file: GlobalBrollGroup['files'][0] }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function bajar() {
    setBusy(true)
    try {
      const res = await getR2DownloadUrl(file.id)
      if ('error' in res && res.error) {
        toast({ title: 'No se pudo bajar', description: res.error, variant: 'destructive' })
      } else if ('url' in res && res.url) {
        window.open(res.url, '_blank', 'noopener')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
      <p className="min-w-0 truncate text-[12px]">{file.name}</p>
      <span className="flex shrink-0 items-center gap-1.5">
        {file.driveViewLink && (
          <a
            href={file.driveViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" /> Ver
          </a>
        )}
        <button
          type="button"
          onClick={bajar}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Bajar
        </button>
      </span>
    </li>
  )
}
