'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { History, Loader2 } from 'lucide-react'
import { listIdeaVersions, type IdeaVersionRow } from '@/lib/actions/idea-versions'

const REASON_LABEL: Record<string, string> = {
  brief_updated: 'Brief editado',
  title_updated: 'Título editado',
  discarded: 'Descartada',
  status_changed: 'Estado cambiado',
  fields_updated: 'Campos actualizados',
}

/**
 * Historial compacto de versiones (snapshots previos a sobrescribir).
 * Sirve para recuperar el texto anterior si alguien editó de más.
 */
export function IdeaVersionsHistory({ ideaId }: { ideaId: string }) {
  const [versions, setVersions] = useState<IdeaVersionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setVersions(null)
    setError(null)
    listIdeaVersions(ideaId).then((res) => {
      if (cancelled) return
      if (res.error) {
        setError(res.error)
        setVersions([])
        return
      }
      setVersions(res.versions ?? [])
    })
    return () => { cancelled = true }
  }, [ideaId])

  if (versions === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Cargando historial…
      </p>
    )
  }

  if (error) {
    return <p className="text-sm text-muted-foreground">No se pudo cargar el historial: {error}</p>
  }

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay versiones guardadas. Se crean al editar el brief, el título o al descartar.
      </p>
    )
  }

  return (
    <ul className="space-y-3" data-testid="idea-versions-history">
      {versions.map((v) => {
        let when = ''
        try {
          when = formatDistanceToNow(new Date(v.createdAt), { addSuffix: true, locale: es })
        } catch {
          when = ''
        }
        const snap = v.snapshot
        const preview = [snap.title, snap.hook].filter(Boolean).join(' — ') || 'Sin texto'
        return (
          <li key={v.id} className="rounded-md border px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <History className="h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden="true" />
              <span className="font-medium">
                {REASON_LABEL[v.reason] ?? v.reason}
              </span>
              {v.creatorName && (
                <span className="text-muted-foreground">· {v.creatorName}</span>
              )}
              {when && <span className="text-xs text-muted-foreground">· {when}</span>}
            </div>
            <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{preview}</p>
            {snap.status && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Estado previo: {snap.status}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
