'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ColorPicker } from '../color-picker'
import { Loader2, Save, Palette, Sparkles } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { updateClientProfile } from '@/lib/actions/client-profile'
import type { Client, BrandColors, BrandFonts } from '@/lib/supabase/types'

interface Props {
  client: Client
}

export function BrandTab({ client }: Props) {
  const [colors, setColors] = useState<BrandColors>(client.brand_colors ?? {})
  const [fonts, setFonts] = useState<BrandFonts>(client.brand_fonts ?? {})
  const [brandVoice, setBrandVoice] = useState(client.brand_voice ?? '')
  const [defaultCta, setDefaultCta] = useState(client.default_cta ?? '')
  const [defaultHashtags, setDefaultHashtags] = useState(client.default_hashtags ?? '')
  const [captionNotes, setCaptionNotes] = useState(client.caption_notes ?? '')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function saveColors() {
    startTransition(async () => {
      const res = await updateClientProfile(client.id, { brand_colors: colors, brand_fonts: fonts })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: 'Paleta y tipografías guardadas' })
    })
  }

  function saveBrandVoice() {
    startTransition(async () => {
      const res = await updateClientProfile(client.id, {
        brand_voice: brandVoice,
        default_cta: defaultCta,
        default_hashtags: defaultHashtags,
        caption_notes: captionNotes,
      })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: 'Voz y captions guardado' })
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Paleta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ColorPicker label="Primario" value={colors.primary ?? null} onChange={(v) => setColors({ ...colors, primary: v })} />
            <ColorPicker label="Secundario" value={colors.secondary ?? null} onChange={(v) => setColors({ ...colors, secondary: v })} />
            <ColorPicker label="Acento" value={colors.accent ?? null} onChange={(v) => setColors({ ...colors, accent: v })} />
            <ColorPicker label="Texto" value={colors.text ?? null} onChange={(v) => setColors({ ...colors, text: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="font-primary" className="text-xs">Tipografía primaria</Label>
              <Input
                id="font-primary"
                value={fonts.primary ?? ''}
                onChange={(e) => setFonts({ ...fonts, primary: e.target.value })}
                placeholder="Ej: Montserrat Bold"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="font-secondary" className="text-xs">Tipografía secundaria</Label>
              <Input
                id="font-secondary"
                value={fonts.secondary ?? ''}
                onChange={(e) => setFonts({ ...fonts, secondary: e.target.value })}
                placeholder="Ej: Lato"
                className="h-9"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Las Gráficas IA usan estos colores y tipografías. El archivo de la fuente (.ttf/.otf) se sube en la
            pestaña Assets como &ldquo;Tipografía&rdquo;.
          </p>
          <Button onClick={saveColors} disabled={isPending} size="sm" className="w-full">
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
            Guardar paleta y tipografías
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Voz y captions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bv" className="text-xs">Brand voice / tono</Label>
            <Textarea id="bv" value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} rows={3} placeholder="Profesional pero cercano, usa humor sutil…" className="resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cta" className="text-xs">CTA por defecto</Label>
            <Input id="cta" value={defaultCta} onChange={(e) => setDefaultCta(e.target.value)} placeholder="Reserva en…" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hash" className="text-xs">Hashtags</Label>
            <Textarea id="hash" value={defaultHashtags} onChange={(e) => setDefaultHashtags(e.target.value)} rows={2} placeholder="#tag1 #tag2" className="resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">Notas para captions AI</Label>
            <Textarea id="notes" value={captionNotes} onChange={(e) => setCaptionNotes(e.target.value)} rows={3} placeholder="Evita decir X. Siempre menciona Y." className="resize-none" />
          </div>
          <Button onClick={saveBrandVoice} disabled={isPending} size="sm" className="w-full">
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
            Guardar voz y captions
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
