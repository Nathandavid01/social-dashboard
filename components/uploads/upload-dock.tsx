'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUploadStore, type UploadItem, type UploadPhase } from '@/lib/stores/upload-store'
import { NateUploadLogo } from './nate-upload-logo'

const TERMINAL_PHASES: ReadonlySet<UploadPhase> = new Set<UploadPhase>(['listo', 'error', 'cancelado'])

/** Spanish, says-what's-happening copy per phase — never a mute bar. */
function phaseText(item: UploadItem): string {
  switch (item.phase) {
    case 'preparando':
      return 'Preparando…'
    case 'subiendo':
      return item.partsTotal > 1
        ? `Subiendo… ${item.pct}% · parte ${Math.min(item.partsDone + 1, item.partsTotal)} de ${item.partsTotal}`
        : `Subiendo… ${item.pct}%`
    case 'reintentando':
      return `Se cayó la conexión — reintentando (${item.attempt} de 5)…`
    case 'ensamblando':
      return 'Ensamblando el archivo'
    case 'registrando':
      return 'Registrando el video'
    case 'analizando':
      return 'La IA está viendo el video…'
    case 'listo':
      return 'Listo'
    case 'error':
      return item.error ? `Falló: ${item.error}` : 'Falló la subida'
    case 'cancelado':
      return 'Cancelado'
  }
}

/**
 * Small, always-visible corner indicator for uploads in flight — the whole
 * point of the resilient-upload feature is that leaving the screen doesn't
 * kill the upload, so there has to be something visible everywhere that
 * proves it's still going. Bottom-LEFT on purpose: ChatBubble already owns
 * bottom-right.
 */
export function UploadDock() {
  const uploads = useUploadStore((s) => s.uploads)
  const cancelUpload = useUploadStore((s) => s.cancelUpload)
  const dismissUpload = useUploadStore((s) => s.dismissUpload)
  const [expanded, setExpanded] = useState(false)

  const items = Object.values(uploads).sort((a, b) => (a.id < b.id ? -1 : 1))
  const active = items.filter((i) => !TERMINAL_PHASES.has(i.phase))

  // Closing the tab kills the upload (the File lives in memory) — warn before
  // that happens. Navigating within the app is fine; the engine survives it.
  useEffect(() => {
    if (active.length === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [active.length])

  if (items.length === 0) return null
  const headline = active[0] ?? items[0]
  const avgPct = active.length > 0 ? Math.round(active.reduce((s, i) => s + i.pct, 0) / active.length) : items[0].pct

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
      {expanded && (
        <div className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background shadow-2xl">
          <div className="max-h-80 space-y-1 overflow-y-auto p-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
                <NateUploadLogo pct={item.pct} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{item.fileName}</p>
                  <p className={cn('truncate text-[11px]', item.phase === 'error' ? 'text-red-500' : 'text-muted-foreground')}>
                    {phaseText(item)}
                  </p>
                </div>
                {TERMINAL_PHASES.has(item.phase) ? (
                  <button
                    type="button"
                    aria-label="Cerrar"
                    onClick={() => dismissUpload(item.id)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Cancelar"
                    onClick={() => cancelUpload(item.id)}
                    className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-red-500/50 hover:text-red-500"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        data-testid="upload-dock"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-background py-1.5 pl-1.5 pr-3 text-xs font-medium shadow-lg transition hover:border-primary/50"
      >
        <NateUploadLogo pct={avgPct} size={28} />
        <span className="flex flex-col items-start leading-tight">
          <span className="max-w-[9rem] truncate">{phaseText(headline)}</span>
          {items.length > 1 && (
            <span className="text-[10px] text-muted-foreground">{items.length} subidas</span>
          )}
        </span>
      </button>
    </div>
  )
}
