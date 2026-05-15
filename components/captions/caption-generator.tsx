'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles, Copy, CheckCheck, RefreshCw } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import type { Client } from '@/lib/supabase/types'

const platforms = ['Instagram', 'TikTok', 'Facebook', 'Twitter/X'] as const

export function CaptionGenerator() {
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [platform, setPlatform] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [generatedCaption, setGeneratedCaption] = useState('')
  const [examplesUsed, setExamplesUsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseClient()
    supabase
      .from('clients')
      .select('*')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (data) setClients(data as Client[])
      })
  }, [])

  useEffect(() => {
    const client = clients.find((c) => c.id === selectedClientId) ?? null
    setSelectedClient(client)
    if (client?.platforms?.[0]) {
      const p = client.platforms[0]
      setPlatform(p.charAt(0).toUpperCase() + p.slice(1))
    }
  }, [selectedClientId, clients])

  const handleGenerate = async () => {
    if (!videoTitle.trim()) {
      toast({ title: 'Falta el tema', description: 'Escribe el título o tema del video', variant: 'destructive' })
      return
    }

    setLoading(true)
    setGeneratedCaption('')
    setExamplesUsed(0)

    try {
      const res = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle,
          platform,
          clientName: selectedClient?.name || '',
          industry: selectedClient?.industry || '',
          metricoolBlogId: selectedClient?.metricool_blog_id || '',
          brandVoice: selectedClient?.brand_voice || '',
          captionLanguage: selectedClient?.caption_language || 'spanish',
          defaultCta: selectedClient?.default_cta || '',
          defaultHashtags: selectedClient?.default_hashtags || '',
          captionNotes: selectedClient?.caption_notes || '',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error generando caption')

      setGeneratedCaption(data.caption)
      setExamplesUsed(data.examplesUsed ?? 0)
      toast({
        title: 'Caption generado',
        description: data.examplesUsed > 0
          ? `Basado en ${data.examplesUsed} captions reales de Metricool`
          : 'Generado con el perfil del cliente',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo generar el caption',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCaption)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Copiado al portapapeles' })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plataforma" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="video">Título o tema del video</Label>
              <Input
                id="video"
                placeholder="ej. 3 tips para el cabello en verano"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
            </div>
          </div>

          {selectedClient && (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              {selectedClient.brand_voice && <p><span className="font-medium">Voz:</span> {selectedClient.brand_voice}</p>}
              {selectedClient.caption_language && <p><span className="font-medium">Idioma:</span> {selectedClient.caption_language}</p>}
              {selectedClient.default_cta && <p><span className="font-medium">CTA:</span> {selectedClient.default_cta}</p>}
              {selectedClient.caption_notes && <p><span className="font-medium">Reglas:</span> {selectedClient.caption_notes}</p>}
              {selectedClient.metricool_blog_id && (
                <p className="text-green-600 dark:text-green-400"><span className="font-medium">Metricool:</span> perfil de estilo conectado</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loading ? 'Generando...' : 'Generar Caption'}
            </Button>
            <Button variant="outline" onClick={() => { setSelectedClientId(''); setPlatform(''); setVideoTitle(''); setGeneratedCaption(''); setExamplesUsed(0) }}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {generatedCaption && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Caption generado</Label>
                {examplesUsed > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">Aprendido de {examplesUsed} captions reales de este cliente</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Regenerar
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <CheckCheck className="mr-2 h-3.5 w-3.5 text-green-500" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
            <Textarea
              value={generatedCaption}
              onChange={(e) => setGeneratedCaption(e.target.value)}
              rows={12}
              className="font-mono text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground">Puedes editar el caption directamente antes de copiarlo.</p>
          </CardContent>
        </Card>
      )}

      {!generatedCaption && !loading && (
        <div className="text-center py-16 text-muted-foreground">
          <Sparkles className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p className="text-lg font-medium">Genera captions con IA</p>
          <p className="text-sm mt-1">Selecciona un cliente, escribe el título del video y presiona &quot;Generar Caption&quot;</p>
          <p className="text-xs mt-2 opacity-60">La IA aprende del estilo real de cada cliente en Metricool</p>
        </div>
      )}
    </div>
  )
}
