'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import { APP_VERSION } from '@/lib/version'
import { cn } from '@/lib/utils'
import type { ChangelogEntry } from '@/lib/changelog/entries'

/**
 * «Novedades»: al entrar con una versión que todavía no ha visto, cada persona
 * recorre lo nuevo paso a paso (titular, viñetas y captura de cada versión).
 *
 * UpdateNotice recarga la pestaña al salir un deploy; al montar el bundle nuevo
 * APP_VERSION ya no coincide con lo guardado y esto se abre. Lo visto vive en
 * localStorage por navegador. Un fallo de red no marca nada: sale la próxima vez.
 */
// react-markdown + remark-gfm solo cuando el modal se abre: este componente se
// monta en todas las rutas del dashboard y casi nunca muestra nada.
const WhatsNewMarkdown = dynamic(() => import('./whats-new-markdown').then((m) => m.WhatsNewMarkdown), {
  ssr: false,
  loading: () => <span className="block h-16 animate-pulse rounded bg-muted-foreground/10" />,
})

export const WHATS_NEW_STORAGE_KEY = 'nate:novedades:vista'

function readSeen(): string | null {
  try {
    return localStorage.getItem(WHATS_NEW_STORAGE_KEY)
  } catch {
    return null
  }
}

function markSeen() {
  try {
    localStorage.setItem(WHATS_NEW_STORAGE_KEY, APP_VERSION)
  } catch {
    /* modo privado sin storage: volverá a salir, no pasa nada */
  }
}

export function WhatsNew() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const seen = readSeen()
    if (seen === APP_VERSION) return
    let alive = true
    const url = seen ? `/api/changelog?since=${encodeURIComponent(seen)}` : '/api/changelog'
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return
        const { entries } = (await res.json()) as { entries?: ChangelogEntry[] }
        if (!alive || !Array.isArray(entries)) return
        if (entries.length === 0) return markSeen()
        setEntries(entries)
        setOpen(true)
      })
      .catch(() => {
        /* sin red no hay novedades — se reintenta en la próxima carga */
      })
    return () => {
      alive = false
    }
  }, [])

  function close() {
    markSeen()
    setOpen(false)
  }

  if (entries.length === 0) return null
  const entry = entries[step]
  const isLast = step === entries.length - 1

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-24px)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-5 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <DialogPrimitive.Title className="truncate text-sm font-semibold">Novedades</DialogPrimitive.Title>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                v{entry.version}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {entries.length > 1 && (
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {step + 1} de {entries.length}
                </span>
              )}
              <DialogPrimitive.Close
                aria-label="Cerrar"
                className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div
            key={entry.version}
            className="min-h-0 flex-1 overflow-y-auto px-5 py-5 animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            {entry.headline && (
              <h2 className="text-lg font-semibold leading-snug text-foreground">{entry.headline}</h2>
            )}
            {entry.date && <p className="mt-1 text-xs text-muted-foreground">{entry.date}</p>}
            <div className="mt-4">
              <WhatsNewMarkdown body={entry.body} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-5 py-3">
            <Link
              href="/changelog"
              onClick={close}
              className="min-w-0 truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Ver todo el historial
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              {entries.length > 1 && (
                <div className="mr-1 flex items-center gap-1" aria-hidden>
                  {entries.map((e, i) => (
                    <span
                      key={e.version}
                      className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/40')}
                    />
                  ))}
                </div>
              )}
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                >
                  <ChevronLeft className="h-3 w-3" aria-hidden />
                  Anterior
                </button>
              )}
              {isLast ? (
                <button
                  type="button"
                  onClick={close}
                  className="whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Entendido
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Siguiente
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
