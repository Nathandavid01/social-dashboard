'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Send, Loader2, MessageSquare } from 'lucide-react'

const requestTypes = [
  { value: 'content', label: 'Contenido / Post' },
  { value: 'design', label: 'Diseño gráfico' },
  { value: 'caption', label: 'Caption / Copy' },
  { value: 'scheduling', label: 'Programación de posts' },
  { value: 'report', label: 'Reporte / Análisis' },
  { value: 'call', label: 'Llamada / Reunión' },
  { value: 'campaign', label: 'Campaña especial' },
  { value: 'other', label: 'Otro' },
]

const urgencyLevels = [
  { value: 'low', label: '🟢 Baja — dentro de la semana', color: 'text-green-600' },
  { value: 'normal', label: '🟡 Normal — en 2-3 días', color: 'text-yellow-600' },
  { value: 'high', label: '🟠 Alta — mañana o pasado', color: 'text-orange-600' },
  { value: 'urgent', label: '🔴 Urgente — hoy', color: 'text-red-600' },
]

export function ClientRequestForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    request_type: 'content',
    urgency: 'normal',
    description: '',
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim() || !form.contact_name.trim() || !form.description.trim()) {
      setError('Por favor completa todos los campos requeridos.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/portal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error enviando la solicitud')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">¡Solicitud enviada!</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Tu solicitud fue recibida por el equipo de NMedia PR. Te contactaremos pronto.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg px-4 py-3 text-xs text-muted-foreground w-full text-left space-y-1">
            <p><span className="font-medium">Empresa:</span> {form.company_name}</p>
            <p><span className="font-medium">Tipo:</span> {requestTypes.find(r => r.value === form.request_type)?.label}</p>
            <p><span className="font-medium">Urgencia:</span> {urgencyLevels.find(u => u.value === form.urgency)?.label}</p>
          </div>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => {
              setSuccess(false)
              setForm({ company_name: '', contact_name: '', contact_email: '', contact_phone: '', request_type: 'content', urgency: 'normal', description: '' })
            }}
          >
            Enviar otra solicitud
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MessageSquare className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Nueva Solicitud</CardTitle>
            <CardDescription className="text-xs mt-0.5">El equipo revisará tu solicitud en menos de 24 horas.</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs">
                Empresa <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company"
                placeholder="Nombre de tu empresa"
                value={form.company_name}
                onChange={(e) => update('company_name', e.target.value)}
                className="h-9 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact" className="text-xs">
                Tu nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact"
                placeholder="Tu nombre completo"
                value={form.contact_name}
                onChange={(e) => update('contact_name', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={form.contact_email}
                onChange={(e) => update('contact_email', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="787-000-0000"
                value={form.contact_phone}
                onChange={(e) => update('contact_phone', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Request type + urgency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de solicitud <span className="text-red-500">*</span></Label>
              <Select value={form.request_type} onValueChange={(v) => update('request_type', v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {requestTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Urgencia</Label>
              <Select value={form.urgency} onValueChange={(v) => update('urgency', v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {urgencyLevels.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Descripción de la solicitud <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Describe qué necesitas con el mayor detalle posible. Incluye fechas límite, referencias, o cualquier información relevante..."
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={5}
              className="text-sm resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {form.description.length}/1000
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !form.company_name.trim() || !form.contact_name.trim() || !form.description.trim()}
            className="w-full"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Enviar Solicitud</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
