'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Check, ChevronRight, ChevronLeft, Loader2, Search, Sparkles, CalendarDays, Megaphone, MessageSquareText, PartyPopper, Rocket, ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { createClient, updateClient } from '@/lib/actions/clients'
import { setClientPostingDays } from '@/lib/actions/posting-days'
import { WIZARD_STEPS, wizardProgress, canCreateClient, nextStepKey, prevStepKey, type WizardStepKey } from '@/lib/utils/client-wizard'
import type { ClientFormValues } from '@/lib/validations/client.schema'
import type { Profile, SocialPlatform } from '@/lib/supabase/types'

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
]
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const STEP_ICON: Record<WizardStepKey, typeof Sparkles> = {
  datos: Sparkles,
  metricool: Search,
  cadencia: CalendarDays,
  voz: Megaphone,
  listo: PartyPopper,
}

interface Props {
  teamMembers: Pick<Profile, 'id' | 'full_name' | 'email'>[]
}

const EMPTY: ClientFormValues = {
  name: '',
  industry: '',
  platforms: [],
  status: 'active',
  assigned_to: null,
  notes: '',
  brand_voice: '',
  caption_language: 'spanish',
  default_cta: '',
  default_hashtags: '',
  metricool_blog_id: '',
  caption_notes: '',
}

export function ClientOnboardingWizard({ teamMembers }: Props) {
  const { toast } = useToast()
  const [step, setStep] = useState<WizardStepKey>('datos')
  const [values, setValues] = useState<ClientFormValues>(EMPTY)
  const [days, setDays] = useState<number[]>([])
  const [clientId, setClientId] = useState<string | null>(null)
  const [blogs, setBlogs] = useState<{ id: string; name: string }[]>([])
  const [loadingBlogs, setLoadingBlogs] = useState(false)
  const [isPending, startTransition] = useTransition()

  const set = <K extends keyof ClientFormValues>(k: K, v: ClientFormValues[K]) => setValues((s) => ({ ...s, [k]: v }))
  const { pct, stepNumber, total } = wizardProgress(step)
  const goNext = () => {
    const n = nextStepKey(step)
    if (n) setStep(n)
  }
  const goBack = () => {
    const p = prevStepKey(step)
    if (p) setStep(p)
  }
  // Free navigation among steps once the client exists (you can revisit/fix any step).
  const goStep = (key: WizardStepKey) => {
    if (clientId || key === 'datos') setStep(key)
  }

  function togglePlatform(p: SocialPlatform) {
    set('platforms', values.platforms.includes(p) ? values.platforms.filter((x) => x !== p) : [...values.platforms, p])
  }
  function toggleDay(d: number) {
    setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d].sort()))
  }

  async function fetchBlogs() {
    setLoadingBlogs(true)
    try {
      const res = await fetch('/api/metricool/blogs')
      const data = await res.json()
      if (data.blogs) setBlogs(data.blogs)
    } catch {
      /* fall back to manual input */
    } finally {
      setLoadingBlogs(false)
    }
  }

  // Step 1 → create the client, then continue configuring it.
  function createAndContinue() {
    startTransition(async () => {
      const res = await createClient(values)
      if (res.error || !res.id) {
        toast({ title: 'No se pudo crear', description: res.error ?? 'Intenta de nuevo', variant: 'destructive' })
        return
      }
      setClientId(res.id)
      toast({ title: '✅ Cliente creado', description: 'Ahora completemos su configuración.' })
      goNext()
    })
  }

  // Steps 2 & 4 persist the full (always-valid) client record.
  function saveAndContinue() {
    if (!clientId) return goNext()
    startTransition(async () => {
      const res = await updateClient(clientId, values)
      if (res.error) {
        toast({ title: 'No se pudo guardar', description: res.error, variant: 'destructive' })
        return
      }
      goNext()
    })
  }

  // Step 3 cadence uses the dedicated posting-days action.
  function saveCadenceAndContinue() {
    if (!clientId || days.length === 0) return goNext()
    startTransition(async () => {
      const res = await setClientPostingDays(clientId, days)
      if (res.error) {
        toast({ title: 'No se pudo guardar la cadencia', description: res.error, variant: 'destructive' })
        return
      }
      goNext()
    })
  }

  const current = WIZARD_STEPS.find((s) => s.key === step)!
  const StepIcon = STEP_ICON[step]

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Paso {stepNumber} de {total}</span>
          <span>{pct}% configurado</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {WIZARD_STEPS.map((s, i) => {
            const activeIdx = WIZARD_STEPS.findIndex((x) => x.key === step)
            const done = i < activeIdx
            const active = s.key === step
            // Once the client exists you can jump to any step to review/fix it.
            const clickable = !!clientId || s.key === 'datos'
            return (
              <button
                key={s.key}
                type="button"
                disabled={!clickable}
                onClick={() => goStep(s.key)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  active ? 'bg-primary/15 text-primary' : done ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
                } ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                {done ? <Check className="h-3 w-3" /> : null}
                {s.title}
              </button>
            )
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <StepIcon className="h-5 w-5 text-primary" aria-hidden /> {current.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{current.why}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'datos' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre del cliente *</Label>
                <Input id="name" value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="p. ej. Sofá & Co." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="industry">Industria</Label>
                <Input id="industry" value={values.industry ?? ''} onChange={(e) => set('industry', e.target.value)} placeholder="Restaurante, retail, servicios…" />
              </div>
              <div className="space-y-1.5">
                <Label>Redes sociales *</Label>
                <div className="flex flex-wrap gap-3">
                  {PLATFORMS.map((p) => (
                    <label key={p.value} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={values.platforms.includes(p.value)} onCheckedChange={() => togglePlatform(p.value)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Idioma de los captions</Label>
                  <Select value={values.caption_language} onValueChange={(v) => set('caption_language', v as ClientFormValues['caption_language'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spanish">Español</SelectItem>
                      <SelectItem value="english">Inglés</SelectItem>
                      <SelectItem value="spanglish">Spanglish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Encargado</Label>
                  <Select value={values.assigned_to ?? 'none'} onValueChange={(v) => set('assigned_to', v === 'none' ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {teamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                {/* Revisiting datos after creation saves edits; first time it creates. */}
                <Button onClick={clientId ? saveAndContinue : createAndContinue} disabled={!canCreateClient(values) || isPending}>
                  {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-1.5 h-4 w-4" />}
                  {clientId ? 'Guardar y continuar' : 'Crear y continuar'}
                </Button>
              </div>
            </>
          )}

          {step === 'metricool' && (
            <>
              <div className="space-y-1.5">
                <Label>Cuenta de Metricool</Label>
                {blogs.length > 0 ? (
                  <Select value={values.metricool_blog_id ?? ''} onValueChange={(v) => set('metricool_blog_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                    <SelectContent>
                      {blogs.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name} ({b.id})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input value={values.metricool_blog_id ?? ''} onChange={(e) => set('metricool_blog_id', e.target.value)} placeholder="Blog ID (p. ej. 5062650)" />
                    <Button type="button" variant="outline" onClick={fetchBlogs} disabled={loadingBlogs}>
                      {loadingBlogs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      <span className="ml-1.5 hidden sm:inline">Buscar cuentas</span>
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Sin esto el cliente funciona, pero no se auto-publica ni trae métricas.</p>
              </div>
              <StepNav onBack={goBack} onSkip={goNext} onSave={saveAndContinue} isPending={isPending} />
            </>
          )}

          {step === 'cadencia' && (
            <>
              <div className="space-y-2">
                <Label>¿Qué días se publica?</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`h-9 w-12 rounded-md border text-sm transition-colors ${
                        days.includes(i) ? 'border-primary bg-primary/15 text-primary' : 'border-input text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">El pipeline usa esto para programar y sugerir cuándo grabar/publicar.</p>
              </div>
              <StepNav onBack={goBack} onSkip={goNext} onSave={saveCadenceAndContinue} isPending={isPending} saveLabel={days.length ? 'Guardar y seguir' : 'Seguir'} />
            </>
          )}

          {step === 'voz' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="voice">Voz de marca</Label>
                <Textarea id="voice" rows={2} value={values.brand_voice ?? ''} onChange={(e) => set('brand_voice', e.target.value)} placeholder="Cercana y divertida; tutea; emojis con moderación…" className="resize-none" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cta">CTA preferido</Label>
                  <Input id="cta" value={values.default_cta ?? ''} onChange={(e) => set('default_cta', e.target.value)} placeholder="Agenda hoy / Escríbenos al DM" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tags">Hashtags por defecto</Label>
                  <Input id="tags" value={values.default_hashtags ?? ''} onChange={(e) => set('default_hashtags', e.target.value)} placeholder="#PuertoRico #…" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rules">Reglas a seguir</Label>
                <Textarea id="rules" rows={2} value={values.caption_notes ?? ''} onChange={(e) => set('caption_notes', e.target.value)} placeholder="Nunca menciones precios; evita …" className="resize-none" />
              </div>
              <StepNav onBack={goBack} onSkip={goNext} onSave={saveAndContinue} isPending={isPending} />
            </>
          )}

          {step === 'listo' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                <Rocket className="h-7 w-7 text-primary" aria-hidden />
              </div>
              <div>
                <p className="text-base font-semibold">¡{values.name || 'El cliente'} está listo!</p>
                <p className="text-sm text-muted-foreground">Esto quedó configurado. Lo demás lo puedes completar luego desde el perfil.</p>
              </div>
              <ul className="mx-auto max-w-sm space-y-1.5 text-left text-sm">
                <SummaryItem done label="Cliente creado y activo" />
                <SummaryItem done={!!values.metricool_blog_id?.trim()} label="Metricool conectado" />
                <SummaryItem done={days.length > 0} label={`Días de posteo (${days.length})`} />
                <SummaryItem done={!!values.brand_voice?.trim()} label="Voz de marca" />
              </ul>
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
                {clientId && (
                  <Button asChild>
                    <Link href={`/clients/${clientId}/batch`}><Sparkles className="mr-1.5 h-4 w-4" /> Crear primer lote de videos</Link>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href={clientId ? `/clients/${clientId}` : '/clients'}>Ir al cliente <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                </Button>
              </div>
              <button type="button" onClick={goBack} className="mx-auto mt-1 flex items-center text-xs text-muted-foreground hover:text-foreground">
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Volver a revisar
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StepNav({ onBack, onSkip, onSave, isPending, saveLabel = 'Guardar y seguir' }: { onBack: () => void; onSkip: () => void; onSave: () => void; isPending: boolean; saveLabel?: string }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <div className="flex items-center gap-1">
        <Button variant="ghost" onClick={onBack} disabled={isPending} className="text-muted-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" /> Atrás
        </Button>
        <Button variant="ghost" onClick={onSkip} disabled={isPending} className="text-muted-foreground">
          Saltar por ahora
        </Button>
      </div>
      <Button onClick={onSave} disabled={isPending}>
        {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-1.5 h-4 w-4" />}
        {saveLabel}
      </Button>
    </div>
  )
}

function SummaryItem({ done, label }: { done?: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
        {done ? <Check className="h-3 w-3" /> : <span className="text-[10px]">—</span>}
      </span>
      <span className={done ? '' : 'text-muted-foreground'}>{label}</span>
    </li>
  )
}
