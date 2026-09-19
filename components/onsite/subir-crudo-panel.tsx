'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { useUploadStore } from '@/lib/stores/upload-store'
import { createRecordingSession } from '@/lib/actions/recording-sessions'
import { createContentIdeaManual } from '@/lib/actions/content-ideas'
import { addIdeaToSession, type OnsiteSession } from '@/lib/actions/onsite'
import { ideaTitleFromUpload } from '@/lib/pipeline/banco-direct-upload'
import { isAllowedVideoUploadType } from '@/lib/utils/video-upload-guard'
import { clientDisplayName } from '@/lib/utils/client-display-name'
import {
  pickTodaySession,
  todaySessionCreateValues,
  todaySessionsForClient,
} from '@/lib/onsite/subir-crudo'
import { cn } from '@/lib/utils'

const SELECT =
  'h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 md:text-sm'

export interface SubirCrudoClient {
  id: string
  name: string
}

export function SubirCrudoPanel({
  clients,
  sessions,
  today,
  canUpload,
  canCreateSession,
  defaultClientId = null,
  defaultSessionId = null,
  existingIdeaId = null,
}: {
  clients: SubirCrudoClient[]
  sessions: OnsiteSession[]
  today: string
  canUpload: boolean
  canCreateSession: boolean
  defaultClientId?: string | null
  defaultSessionId?: string | null
  existingIdeaId?: string | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const startUpload = useUploadStore((s) => s.startUpload)
  const fileRef = useRef<HTMLInputElement>(null)
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [sessionId, setSessionId] = useState(defaultSessionId ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [uploadedCount, setUploadedCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const todayForClient = useMemo(
    () => todaySessionsForClient(sessions, clientId, today),
    [sessions, clientId, today],
  )
  const autoSession = pickTodaySession(todayForClient)
  const resolvedSessionId = sessionId || autoSession?.id || ''
  const clientName = clients.find((c) => c.id === clientId)?.name ?? ''
  const canSubmit = !!clientId && files.length > 0 && !pending && (resolvedSessionId || canCreateSession)

  function takeFiles(list: FileList | File[] | null) {
    const next = Array.from(list ?? [])
    setFiles(next)
    setError(null)
    setUploadedCount(0)
  }

  async function submit() {
    if (!clientId) {
      setError('Elige un cliente')
      return
    }
    if (files.length === 0) {
      setError('Elige al menos un video')
      return
    }
    if (files.some((f) => !isAllowedVideoUploadType(f.type))) {
      setError('Solo se aceptan videos (mp4, mov, webm…)')
      return
    }

    setPending(true)
    setError(null)
    try {
      let targetSessionId = resolvedSessionId
      if (!targetSessionId) {
        if (!canCreateSession) {
          setError('Agenda una sesión de hoy en el calendario')
          return
        }
        const created = await createRecordingSession(todaySessionCreateValues({
          clientId,
          clientName,
          today,
        }))
        if (created.error || !created.id) {
          toast({ title: 'No se pudo crear la sesión', description: created.error, variant: 'destructive' })
          return
        }
        targetSessionId = created.id
        setSessionId(created.id)
      }

      const reuseIdea = targetSessionId === defaultSessionId ? existingIdeaId : null
      const title = ideaTitleFromUpload('', files)
      let ideaId = reuseIdea
      if (!ideaId) {
        const idea = await createContentIdeaManual({
          clientId,
          contentType: 'R',
          title: title || 'Crudo',
        })
        if (idea.error || !idea.idea) {
          toast({ title: 'No se pudo crear la idea', description: idea.error, variant: 'destructive' })
          return
        }
        ideaId = idea.idea.id
        const linked = await addIdeaToSession({
          sessionId: targetSessionId,
          ideaId,
          source: 'pipeline',
        })
        if (linked.error) {
          toast({ title: 'Idea creada sin vincular', description: linked.error, variant: 'destructive' })
          return
        }
      }

      for (const file of files) {
        startUpload({ file, ideaId, kind: 'raw', provider: 'r2', title: title || 'Crudo' })
      }
      setUploadedCount(files.length)
      setFiles([])
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  if (!canUpload) return null

  return (
    <section className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-card p-4 ring-1 ring-primary/30 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Puerta principal</p>
          <h2 className="text-xl font-semibold tracking-tight">Subir crudo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cliente → sesión de hoy → videos. Entran al Pipeline como crudo, no como editado ni B-roll.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
          Crudo
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Cliente</span>
          <select
            aria-label="Cliente"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value)
              setSessionId('')
              setUploadedCount(0)
            }}
            className={SELECT}
          >
            <option value="">Elige un cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{clientDisplayName(c.name)}</option>
            ))}
          </select>
        </label>

        {clientId && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Sesión de hoy</span>
            {todayForClient.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                {canCreateSession
                  ? 'Se crea la sesión de hoy al subir.'
                  : 'Agenda una sesión de hoy en el calendario.'}
              </p>
            ) : todayForClient.length === 1 ? (
              <p className="rounded-lg border bg-background px-3 py-2.5 text-sm">
                {clientDisplayName(todayForClient[0].title || clientName)} · hoy
              </p>
            ) : (
              <select
                aria-label="Sesión de hoy"
                value={resolvedSessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className={SELECT}
              >
                <option value="">Elige la sesión de hoy</option>
                {todayForClient.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || clientName}{s.location ? ` · ${s.location}` : ''}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}

        <div
          className={cn(
            'rounded-xl border border-dashed px-3 py-4 text-center transition',
            dragOver && 'border-primary bg-primary/10',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            takeFiles(e.dataTransfer.files)
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => takeFiles(e.target.files)}
          />
          <p className="text-sm font-medium">Arrastra los videos o elige archivos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {files.length === 0
              ? 'mp4, mov, webm… Se suben como crudo.'
              : files.length === 1
                ? files[0].name
                : `${files.length} videos listos`}
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 inline-flex min-h-11 items-center rounded-lg border px-3 text-sm"
          >
            Elegir archivos
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {pending ? 'Subiendo…' : 'Subir crudo'}
        </button>

        {uploadedCount > 0 && (
          <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {uploadedCount === 1 ? 'El archivo está en Pipeline' : `${uploadedCount} archivos están en Pipeline`}
            {' · '}
            <Link href="/pipeline" className="font-semibold underline-offset-2 hover:underline">
              Abrir Pipeline
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}
