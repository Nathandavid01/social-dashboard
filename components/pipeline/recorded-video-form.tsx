'use client'

import { useMemo, useState, useTransition } from 'react'
import { Sparkles, RefreshCw, Plus, Trash2, Check, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BATCH_STAGES, type BatchStageKey } from '@/lib/utils/content-batches'
import {
  RECORDED_ENTRY_STAGES,
  classifyEntry,
  type RecordedEntryStage,
} from '@/lib/utils/recorded-entry'

const STAGE_LABEL = Object.fromEntries(BATCH_STAGES.map((s) => [s.key, s.label])) as Record<BatchStageKey, string>
const STAGE_DOT: Record<BatchStageKey, string> = {
  idea: '#3b82f6', title: '#64748b', caption: '#a855f7', video: '#06b6d4',
  edited: '#8b5cf6', approval: '#f59e0b', publication: '#10b981',
}
const ENTRY_KIND: Record<RecordedEntryStage, string> = { video: 'raw', edited: 'editado', approval: 'editado' }
const MAX_RAW = 5

export interface RecordedVideoInput {
  clientId: string
  title: string
  entryStage: RecordedEntryStage
  assigneeId: string | null
  caption: string | null
  rawLinks: string[]
  editedLink: string | null
}

export interface RecordedVideoFormProps {
  clients: { id: string; name: string }[]
  team: { id: string; name: string }[]
  onCreate: (input: RecordedVideoInput) => Promise<{ ideaId?: string; error?: string }>
  onGenerateCaption: (args: { clientId: string; title: string }) => Promise<{ caption?: string; error?: string }>
  onDone: () => void
  onError?: (message: string) => void
}

export function RecordedVideoForm({ clients, team, onCreate, onGenerateCaption, onDone, onError }: RecordedVideoFormProps) {
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [entryStage, setEntryStage] = useState<RecordedEntryStage>('video')
  const [assigneeId, setAssigneeId] = useState('')
  const [caption, setCaption] = useState('')
  const [rawLinks, setRawLinks] = useState<string[]>([''])
  const [editedLink, setEditedLink] = useState('')
  const [generating, setGenerating] = useState(false)
  const [pending, startSubmit] = useTransition()

  const cls = useMemo(() => classifyEntry(entryStage), [entryStage])
  const canCreate = !!clientId && title.trim().length > 0 && !pending
  const canGenerate = title.trim().length > 0 && !generating

  function setRaw(i: number, v: string) {
    setRawLinks((arr) => arr.map((x, idx) => (idx === i ? v : x)))
  }
  function addRaw() {
    setRawLinks((arr) => (arr.length >= MAX_RAW ? arr : [...arr, '']))
  }
  function removeRaw(i: number) {
    setRawLinks((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)))
  }

  async function generate() {
    if (!canGenerate) return
    setGenerating(true)
    const res = await onGenerateCaption({ clientId, title: title.trim() })
    setGenerating(false)
    if (res.error) { onError?.(res.error); return }
    if (res.caption) setCaption(res.caption)
  }

  function submit() {
    if (!canCreate) return
    startSubmit(async () => {
      const res = await onCreate({
        clientId,
        title: title.trim(),
        entryStage,
        assigneeId: assigneeId || null,
        caption: caption.trim() || null,
        rawLinks: rawLinks.map((l) => l.trim()).filter(Boolean),
        editedLink: editedLink.trim() || null,
      })
      if (res.error) { onError?.(res.error); return }
      onDone()
    })
  }

  const selectCls = 'h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground focus:border-primary/50 focus:outline-none'
  const inputCls = selectCls

  return (
    <div className="space-y-4">
      {/* Cliente */}
      <Field label="Cliente">
        <select aria-label="Cliente" className={selectCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Selecciona un cliente…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>

      {/* Columna de entrada */}
      <Field label="Columna de entrada">
        <div className="flex gap-2">
          {RECORDED_ENTRY_STAGES.map((s) => {
            const on = entryStage === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setEntryStage(s)}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition',
                  on ? 'text-foreground' : 'border-white/[0.08] text-muted-foreground hover:bg-white/[0.04]',
                )}
                style={on ? { borderColor: STAGE_DOT[s], backgroundColor: `${STAGE_DOT[s]}1f` } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STAGE_DOT[s] }} />
                {STAGE_LABEL[s]}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Raw videos */}
      <Field label={`Videos raw (${rawLinks.length}/${MAX_RAW})`}>
        <div className="space-y-2">
          {rawLinks.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={inputCls}
                placeholder={`Link de Drive (raw ${i + 1})`}
                value={link}
                onChange={(e) => setRaw(i, e.target.value)}
              />
              {rawLinks.length > 1 && (
                <button type="button" aria-label={`Quitar raw ${i + 1}`} onClick={() => removeRaw(i)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] text-muted-foreground hover:bg-white/[0.04]">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addRaw}
            disabled={rawLinks.length >= MAX_RAW}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar raw
          </button>
        </div>
      </Field>

      {/* Edited video */}
      <Field label="Video editado">
        <input
          className={inputCls}
          placeholder="Link de Drive (editado)"
          value={editedLink}
          onChange={(e) => setEditedLink(e.target.value)}
        />
      </Field>

      {/* Título */}
      <Field label="Título del video">
        <input aria-label="Título del video" className={inputCls} placeholder="Promo Black Friday" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      {/* Asignado a */}
      <Field label="Asignado a">
        <select aria-label="Asignado a" className={selectCls} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Sin asignar</option>
          {team.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>

      {/* Caption + IA */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="rv-caption" className="text-[11px] font-medium text-muted-foreground">
            Caption <span className="text-muted-foreground/60">· opcional</span>
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={!canGenerate}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/20 disabled:pointer-events-none disabled:opacity-40"
          >
            <Sparkles className="h-3 w-3" /> {generating ? 'Generando…' : 'Generar con IA'}
          </button>
        </div>
        <textarea
          id="rv-caption"
          aria-label="Caption"
          rows={3}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
          placeholder="Escribe el caption…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        {caption && (
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70"><Sparkles className="h-2.5 w-2.5" /> Generado con IA desde el título</span>
            <button type="button" onClick={generate} disabled={!canGenerate} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40">
              <RefreshCw className="h-3 w-3" /> Regenerar
            </button>
          </div>
        )}
      </div>

      {/* Classification indicator */}
      <div className="space-y-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" />
          <span className="text-[12px] font-semibold">Cómo se clasificará este video</span>
        </div>
        <div className="flex items-start gap-1.5">
          {BATCH_STAGES.map((s) => {
            const isSkipped = cls.skipped.includes(s.key)
            const isEntry = cls.entry === s.key
            return (
              <div
                key={s.key}
                className={cn('flex flex-1 flex-col items-center gap-1 rounded-md px-1 py-1', isEntry && 'border')}
                style={isEntry ? { borderColor: STAGE_DOT[s.key], backgroundColor: `${STAGE_DOT[s.key]}1f` } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isSkipped ? '#6b6b70' : STAGE_DOT[s.key] }} />
                <span className={cn('text-[9px]', isEntry ? 'font-bold text-foreground' : isSkipped ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground')}>{s.label}</span>
                {isEntry && <span className="text-[8px] font-semibold" style={{ color: STAGE_DOT[s.key] }}>entra aquí</span>}
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Entra en <span className="font-semibold" style={{ color: STAGE_DOT[cls.entry] }}>{STAGE_LABEL[cls.entry]}</span>
          {cls.skipped.length > 0 && <> · salta {cls.skipped.map((k) => STAGE_LABEL[k]).join(', ')}</>}
          {cls.upcoming.length > 0 && <> · faltan {cls.upcoming.map((k) => STAGE_LABEL[k]).join(' → ')}</>}
          {' '}<span className="text-muted-foreground/60">· adjuntas {ENTRY_KIND[entryStage]}</span>
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!canCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> {pending ? 'Creando…' : 'Clasificar y crear'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
