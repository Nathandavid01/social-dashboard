'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { upsertProductionSchedules, deleteClientSchedules } from '@/lib/actions/production'
import type { ProductionContentType, Profile } from '@/lib/supabase/types'
import { X, Loader2, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { friendlyError } from '@/lib/utils/error-message'

const DAYS = [
  { num: 1, label: 'Lunes' },
  { num: 2, label: 'Martes' },
  { num: 3, label: 'Miércoles' },
  { num: 4, label: 'Jueves' },
  { num: 5, label: 'Viernes' },
  { num: 6, label: 'Sábado' },
  { num: 7, label: 'Domingo' },
]

interface DayConfig {
  dayOfWeek: number
  contentType: ProductionContentType
  editorId: string
  designerId: string
}

interface Client {
  id: string
  name: string
}

interface ExistingSchedule {
  id: string
  client_id: string
  day_of_week: number
  content_type: ProductionContentType
  assigned_editor_id: string | null
  assigned_designer_id: string | null
}

interface Props {
  clients: Client[]
  profiles: Pick<Profile, 'id' | 'full_name'>[]
  existingSchedules: ExistingSchedule[]
  onClose: () => void
}

const editors = (profiles: Pick<Profile, 'id' | 'full_name'>[]) =>
  profiles // show all for flexibility

export function ManageSchedulesModal({ clients, profiles, existingSchedules, onClose }: Props) {
  const router = useRouter()
  const [selectedClientId, setSelectedClientId] = useState('')
  const [days, setDays] = useState<DayConfig[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { toast } = useToast()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing schedule when client changes
  useEffect(() => {
    if (!selectedClientId) { setDays([]); return }
    const existing = existingSchedules
      .filter(s => s.client_id === selectedClientId)
      .map(s => ({
        dayOfWeek: s.day_of_week,
        contentType: s.content_type,
        editorId: s.assigned_editor_id ?? '',
        designerId: s.assigned_designer_id ?? '',
      }))
    setDays(existing.length ? existing : [])
    setSaved(false)
    setError(null)
  }, [selectedClientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const addDay = () => {
    setDays(prev => [...prev, { dayOfWeek: 1, contentType: 'R', editorId: '', designerId: '' }])
  }

  const removeDay = (idx: number) => {
    setDays(prev => prev.filter((_, i) => i !== idx))
  }

  const updateDay = (idx: number, field: keyof DayConfig, value: string | number) => {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))
  }

  const save = async () => {
    if (!selectedClientId) return
    setSaving(true)
    setError(null)
    const existingDays = existingSchedules.filter(s => s.client_id === selectedClientId).map(s => s.day_of_week)
    const result = await upsertProductionSchedules(
      selectedClientId,
      days.map(d => ({
        day_of_week: d.dayOfWeek,
        content_type: d.contentType,
        assigned_editor_id: d.editorId || null,
        assigned_designer_id: d.designerId || null,
      })),
      existingDays
    )
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 2500)
    }
  }

  const deleteAll = async () => {
    if (!selectedClientId) return
    setDeleting(true)
    const res = await deleteClientSchedules(selectedClientId)
    setDeleting(false)
    if (res?.error) {
      toast({ title: 'Error', description: friendlyError(res.error), variant: 'destructive' })
      return
    }
    setDays([])
    setConfirmOpen(false)
    toast({ title: 'Horarios eliminados' })
    router.refresh()
  }

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const hasExisting = existingSchedules.some(s => s.client_id === selectedClientId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">Gestionar Horarios</h2>
            <p className="text-xs text-muted-foreground">Configura qué días y tipos de contenido publica cada cliente</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Client picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Cliente</label>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="w-full text-sm rounded-lg border border-border bg-card px-3 py-2"
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {existingSchedules.some(s => s.client_id === c.id) ? '✓' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Day configs */}
          {selectedClientId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {days.length === 0
                    ? 'Sin horario configurado'
                    : `${days.length} publicación${days.length !== 1 ? 'es' : ''} por semana`}
                </p>
                <div className="flex items-center gap-2">
                  {hasExisting && (
                    <button
                      onClick={() => setConfirmOpen(true)}
                      disabled={deleting}
                      className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1 transition-colors"
                    >
                      {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Borrar todo
                    </button>
                  )}
                  <button
                    onClick={addDay}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar día
                  </button>
                </div>
              </div>

              {days.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground text-sm">
                  <p>Sin publicaciones programadas.</p>
                  <p className="text-xs mt-1">Haz clic en "Agregar día" para comenzar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-[130px_90px_1fr_1fr_28px] gap-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Día</span><span>Tipo</span><span>Editor</span><span>Diseñador</span><span />
                  </div>

                  {days.map((day, idx) => (
                    <div key={idx} className="grid grid-cols-[130px_90px_1fr_1fr_28px] gap-2 items-center bg-muted/20 rounded-lg p-2">
                      {/* Day picker */}
                      <select
                        value={day.dayOfWeek}
                        onChange={e => updateDay(idx, 'dayOfWeek', Number(e.target.value))}
                        className="text-xs rounded-md border border-border bg-card px-2 py-1.5 w-full"
                      >
                        {DAYS.map(d => <option key={d.num} value={d.num}>{d.label}</option>)}
                      </select>

                      {/* Content type */}
                      <div className="flex gap-1">
                        {(['R', 'P'] as ProductionContentType[]).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateDay(idx, 'contentType', t)}
                            className={cn(
                              'flex-1 py-1 rounded-md text-xs font-bold border transition-colors',
                              day.contentType === t
                                ? t === 'R'
                                  ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                  : 'bg-zinc-900 text-yellow-300 border-zinc-700'
                                : 'border-border text-muted-foreground hover:bg-muted'
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      {/* Editor */}
                      <select
                        value={day.editorId}
                        onChange={e => updateDay(idx, 'editorId', e.target.value)}
                        className="text-xs rounded-md border border-border bg-card px-2 py-1.5 w-full"
                      >
                        <option value="">Sin asignar</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.full_name?.split(' ')[0]}</option>
                        ))}
                      </select>

                      {/* Designer */}
                      <select
                        value={day.designerId}
                        onChange={e => updateDay(idx, 'designerId', e.target.value)}
                        className="text-xs rounded-md border border-border bg-card px-2 py-1.5 w-full"
                      >
                        <option value="">Sin asignar</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.full_name?.split(' ')[0]}</option>
                        ))}
                      </select>

                      {/* Remove */}
                      <button
                        onClick={() => removeDay(idx)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between shrink-0">
          <p className="text-xs text-muted-foreground">
            {saved && <span className="text-green-600 font-medium">✓ Horario guardado</span>}
            {!saved && selectedClient && <span>Editando: <strong>{selectedClient.name}</strong></span>}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
              Cerrar
            </button>
            {selectedClientId && (
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar horario
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => { if (!deleting) setConfirmOpen(o) }}
        title="Eliminar todos los horarios"
        description={selectedClient
          ? `Se eliminarán todos los horarios de ${selectedClient.name}. Esta acción no se puede deshacer.`
          : 'Esta acción no se puede deshacer.'}
        confirmLabel="Eliminar todo"
        destructive
        loading={deleting}
        onConfirm={deleteAll}
      />
    </div>
  )
}
