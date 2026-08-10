'use client'

import { useRef, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Save, Loader2, RotateCcw, Upload, Check } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  LOGO_PRESETS,
  type AgencyBranding,
  type LogoPreset,
} from '@/lib/utils/agency-branding'
import { AgencyMark } from '@/components/brand/agency-mark'
import {
  updateAgencyBranding,
  uploadAgencyLogo,
  resetAgencyBranding,
} from '@/lib/actions/agency-branding'

interface Props {
  initial: AgencyBranding
}

export function AgencyBrandingForm({ initial }: Props) {
  const [form, setForm] = useState<AgencyBranding>(initial)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  function setField<K extends keyof AgencyBranding>(key: K, value: AgencyBranding[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function choosePreset(preset: LogoPreset) {
    setForm((f) => ({
      ...f,
      logo_preset: preset,
      // Keep custom URL when switching away so re-selecting custom works
    }))
  }

  function save() {
    startTransition(async () => {
      const res = await updateAgencyBranding({
        brand_name: form.brand_name,
        tagline: form.tagline,
        logo_preset: form.logo_preset,
        logo_url: form.logo_url,
        primary_color: form.primary_color,
        apply_on_login: form.apply_on_login,
      })
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      } else {
        if (res.branding) setForm(res.branding)
        toast({ title: 'Marca guardada', description: 'Sidebar y login usarán esta identidad.' })
      }
    })
  }

  function onUpload(file: File | null) {
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    startTransition(async () => {
      const res = await uploadAgencyLogo(fd)
      if (res.error) {
        toast({ title: 'Error al subir', description: res.error, variant: 'destructive' })
      } else if (res.branding) {
        setForm(res.branding)
        toast({ title: 'Logo subido', description: 'Preset «Logo propio» activado.' })
      }
    })
  }

  function reset() {
    startTransition(async () => {
      const res = await resetAgencyBranding()
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      } else if (res.branding) {
        setForm(res.branding)
        toast({ title: 'Restaurado a Nate Media' })
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Live preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vista previa</CardTitle>
          <CardDescription>
            Así se verá la marca en el sidebar y (si está activado) en el login.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Sidebar
            </p>
            <AgencyMark branding={form} size={32} showWordmark />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Login (oscuro)
            </p>
            <AgencyMark branding={form} size={48} showWordmark onDark />
          </div>
        </CardContent>
      </Card>

      {/* Logo presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Logo del dashboard</CardTitle>
          <CardDescription>
            Elige el monograma de Nate Media, el radar animado, o sube el logo de tu agencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {LOGO_PRESETS.map((p) => {
              const active = form.logo_preset === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePreset(p.id)}
                  className={cn(
                    'relative flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-accent/40',
                  )}
                >
                  {active && (
                    <span className="absolute right-2 top-2 text-primary">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-950">
                    <AgencyMark
                      branding={{
                        ...form,
                        logo_preset: p.id,
                      }}
                      size={40}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => fileRef.current?.click()}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Subir logo propio
            </Button>
            {form.logo_url && form.logo_preset === 'custom' && (
              <p className="text-xs text-muted-foreground truncate max-w-xs">
                Archivo activo
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Name / colors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identidad</CardTitle>
          <CardDescription>
            Nombre de la agencia, eslogan y color de acento (la última palabra del nombre usa este color).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand_name">Nombre de la marca</Label>
            <Input
              id="brand_name"
              value={form.brand_name}
              maxLength={60}
              onChange={(e) => setField('brand_name', e.target.value)}
              placeholder="Nate Media"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Eslogan / subtítulo</Label>
            <Input
              id="tagline"
              value={form.tagline}
              maxLength={80}
              onChange={(e) => setField('tagline', e.target.value)}
              placeholder="Operaciones de contenido"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primary_color">Color de acento</Label>
            <div className="flex gap-2">
              <input
                type="color"
                aria-label="Selector de color"
                value={/^#[0-9A-Fa-f]{6}$/.test(form.primary_color) ? form.primary_color : '#D4A017'}
                onChange={(e) => setField('primary_color', e.target.value.toUpperCase())}
                className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent p-1"
              />
              <Input
                id="primary_color"
                value={form.primary_color}
                onChange={(e) => setField('primary_color', e.target.value)}
                placeholder="#D4A017"
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.apply_on_login}
                onChange={(e) => setField('apply_on_login', e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Aplicar también en la pantalla de login
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar marca
        </Button>
        <Button type="button" variant="outline" onClick={reset} disabled={isPending}>
          <RotateCcw className="h-4 w-4" />
          Restaurar Nate Media
        </Button>
      </div>
    </div>
  )
}
