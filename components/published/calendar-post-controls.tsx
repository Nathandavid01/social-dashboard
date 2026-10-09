'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { calendarPostDate, calendarPostState } from '@/lib/published/calendar-post'
import type { PublishedPost } from '@/app/api/metricool/posts/route'
export interface CalendarStateChange { action: 'draft' | 'schedule'; dateTime?: string; confirmed: boolean; postId?: number; uuid?: string; warning?: string }
export function CalendarPostControls({ post, onChanged, onVerify, onBusy, verifying = false }: { post: PublishedPost; onChanged: (result: CalendarStateChange) => void; onVerify: () => void; onBusy?: (busy: boolean) => void; verifying?: boolean }) {
  const canWrite = useHasPermission('metricool.write')
  const canPublish = useHasPermission('posting.publish')
  const { toast } = useToast()
  const [dateTime, setDateTime] = useState(() => calendarPostDate(post).slice(0, 16))
  const [saving, setSaving] = useState<'draft' | 'schedule' | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const state = calendarPostState(post)
  if (!canWrite) return null
  if (['published', 'partial'].includes(state)) return <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Este post ya se publicó en una o más redes. Su publicación permanece en el historial.</p>
  if (state === 'unknown' || !post.clientId) return <p className="text-xs text-muted-foreground">Verifica el post y su cliente antes de cambiar la programación.</p>
  async function save(action: 'draft' | 'schedule') {
    if (saving || uncertain || verifying) return
    if (action === 'schedule' && (!dateTime || !Number.isFinite(Date.parse(`${dateTime}:00-04:00`)) || new Date(`${dateTime}:00-04:00`) <= new Date())) { setError('Elige una fecha y hora en el futuro.'); return }
    onBusy?.(true)
    startTransition(() => { setSaving(action); setError(null) })
    try {
      const response = await fetch('/api/metricool/calendar-state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, clientId: post.clientId, blogId: post.blogId, postId: post.id, uuid: post.uuid, ...(action === 'schedule' ? { dateTime } : {}), expected: { draft: post.draft, publicationDate: post.publicationDate, timezone: post.timezone, text: post.text } }) })
      const result = await response.json()
      if (!response.ok || !result.ok) {
        setError(result.error || 'No se pudo cambiar el post. Verifica Metricool antes de repetir.')
        setUncertain(result.uncertain === true)
        toast({ title: 'No se pudo confirmar el cambio', description: result.error, variant: 'destructive' })
        return
      }
      if (!result.confirmed) setUncertain(true)
      toast({ title: result.confirmed ? action === 'draft' ? 'Borrador guardado en Metricool' : 'Publicación programada en Metricool' : 'Cambio pendiente de verificar', description: result.warning || (action === 'schedule' ? `${dateTime.replace('T', ' · ')} · Hora de Puerto Rico` : 'La publicación automática está desactivada.') })
      onChanged({ ...result, action, ...(action === 'schedule' ? { dateTime } : {}) })
    } catch {
      setUncertain(true); setError('No se pudo confirmar el cambio. Verifica el calendario antes de repetir la acción.')
      toast({ title: 'Verificación necesaria', description: 'La conexión falló después de enviar el cambio.', variant: 'destructive' })
    } finally { setSaving(null); onBusy?.(false) }
  }
  const disabled = !!saving || pending || uncertain || verifying
  return <div className="space-y-3 rounded-xl border bg-accent/30 p-4">
    <h4 className="text-sm font-semibold">Borrador y programación</h4>
    <p className="text-xs leading-relaxed text-muted-foreground">El borrador queda guardado en Metricool. Al programarlo, se publicará automáticamente en la fecha y hora elegidas.</p>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {saving && <p role="status" className="text-xs text-primary">{saving === 'draft' ? 'Guardando borrador' : 'Programando publicación'} en Metricool…</p>}
    {canPublish && <form onSubmit={e => { e.preventDefault(); void save('schedule') }} className="space-y-2">
      <label htmlFor={`schedule-${post.blogId}-${post.id}`} className="block text-xs font-medium">Fecha y hora de publicación</label>
      <input id={`schedule-${post.blogId}-${post.id}`} type="datetime-local" step="60" required value={dateTime} disabled={disabled} onChange={e => setDateTime(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      <p className="text-[11px] text-muted-foreground">Hora de Puerto Rico (UTC−4)</p>
      <Button type="submit" disabled={disabled} className="w-full">Programar</Button>
    </form>}
    {!post.draft && <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={() => void save('draft')}>Guardar como borrador</Button>}
    {post.draft && <p className="text-xs text-muted-foreground">Este post está guardado como borrador.</p>}
    {(error || uncertain) && <Button type="button" variant="outline" size="sm" disabled={!!saving} onClick={onVerify}>Verificar calendario</Button>}
  </div>
}
