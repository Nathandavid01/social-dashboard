'use client'

import { useState } from 'react'
import { createSpecialRequest } from '@/lib/actions/production'
import type { ProductionContentType, ProductionPriority, Profile } from '@/lib/supabase/types'
import { X, Loader2 } from 'lucide-react'

interface Client {
  id: string
  name: string
}

interface Props {
  clients: Client[]
  profiles: Pick<Profile, 'id' | 'full_name'>[]
  onClose: () => void
  onSuccess: () => void
}

export function SpecialRequestModal({ clients, profiles, onClose, onSuccess }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    clientId: '',
    contentType: 'R' as ProductionContentType,
    publishDate: '',
    assignedToId: '',
    priority: 'media' as ProductionPriority,
    notes: '',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clientId || !form.publishDate) return
    setSaving(true)
    setError(null)
    const result = await createSpecialRequest({
      clientId: form.clientId,
      contentType: form.contentType,
      publishDate: form.publishDate,
      assignedToId: form.assignedToId || null,
      priority: form.priority,
      notes: form.notes,
    })
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      onSuccess()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Solicitud Especial</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cliente *</label>
            <select
              required
              value={form.clientId}
              onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
              className="mt-1 w-full text-sm rounded-lg border border-border bg-card px-3 py-2"
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <div className="flex gap-2 mt-1">
                {(['R', 'P'] as ProductionContentType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, contentType: t }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                      form.contentType === t
                        ? t === 'R'
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                          : 'bg-zinc-900 text-yellow-300 border-zinc-700'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {t === 'R' ? 'Reel' : 'Post'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Prioridad</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as ProductionPriority }))}
                className="mt-1 w-full text-sm rounded-lg border border-border bg-card px-3 py-2"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Fecha de publicación *</label>
            <input
              type="date"
              required
              min={new Date().toISOString().slice(0, 10)}
              value={form.publishDate}
              onChange={e => setForm(f => ({ ...f, publishDate: e.target.value }))}
              className="mt-1 w-full text-sm rounded-lg border border-border bg-card px-3 py-2"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Asignar a</label>
            <select
              value={form.assignedToId}
              onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}
              className="mt-1 w-full text-sm rounded-lg border border-border bg-card px-3 py-2"
            >
              <option value="">Sin asignar</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Notas</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Detalles de la solicitud..."
              className="mt-1 w-full text-sm rounded-lg border border-border bg-card px-3 py-2 resize-none"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Crear solicitud
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
