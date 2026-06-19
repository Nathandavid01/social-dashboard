'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
import { Sparkles, Copy, CheckCheck, RefreshCw, Send, History, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/lib/hooks/use-toast'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { sendCaptionToDraft } from '@/lib/actions/metricool'
import type { Client } from '@/lib/supabase/types'
import { friendlyError } from '@/lib/utils/error-message'

const platforms = ['Instagram', 'TikTok', 'Facebook', 'Twitter/X', 'LinkedIn', 'YouTube'] as const

const HISTORY_KEY = 'nmedia_caption_history'
const MAX_HISTORY = 20

interface HistoryEntry {
  id: string
  clientName: string
  platform: string
  topic: string
  caption: string
  ts: number
}

function saveToHistory(entry: Omit<HistoryEntry, 'id'>) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const history: HistoryEntry[] = raw ? JSON.parse(raw) : []
    const newEntry: HistoryEntry = { ...entry, id: Date.now().toString() }
    const updated = [newEntry, ...history].slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch { /* ignore */ }
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function CaptionHistoryPanel({ onReuse }: { onReuse: (entry: HistoryEntry) => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [open, setOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (open) setHistory(loadHistory())
  }, [open])

  const deleteEntry = (id: string) => {
    const updated = history.filter((h) => h.id !== id)
    setHistory(updated)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  const clearAll = () => {
    localStorage.removeItem(HISTORY_KEY)
    setHistory([])
  }

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const total = loadHistory().length

  return (
    <Card>
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-lg"
        onClick={() => setOpen((v) => !v)}
      >
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Historial de Captions</span>
        {total > 0 && (
          <Badge variant="secondary" className="text-xs ml-1">{total}</Badge>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />}
      </button>

      {open && (
        <CardContent className="pt-0 pb-4">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin historial aún. Los captions generados aparecerán aquí.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAll}>
                  <Trash2 className="h-3 w-3 mr-1" /> Limpiar todo
                </Button>
              </div>
              {history.map((h) => (
                <div key={h.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-primary">{h.clientName || 'Sin cliente'}</span>
                    {h.platform && <Badge variant="outline" className="text-xs">{h.platform}</Badge>}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(h.ts).toLocaleDateString('es-PR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  {h.topic && <p className="text-xs text-muted-foreground italic">&ldquo;{h.topic}&rdquo;</p>}
                  <p className="text-xs line-clamp-3 leading-relaxed">{h.caption}</p>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => copy(h.id, h.caption)}>
                      {copiedId === h.id ? <CheckCheck className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copiedId === h.id ? 'Copiado' : 'Copiar'}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onReuse(h)}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Reusar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground ml-auto" onClick={() => deleteEntry(h.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function CaptionGeneratorInner() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState(searchParams.get('client') ?? '')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [platform, setPlatform] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [generatedCaption, setGeneratedCaption] = useState('')
  const [examplesUsed, setExamplesUsed] = useState(0)
  const [suggestions, setSuggestions] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sendingDraft, setSendingDraft] = useState(false)
  const [draftSent, setDraftSent] = useState(false)

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
          clientId: selectedClient?.id || '',
          clientName: selectedClient?.name || '',
          industry: selectedClient?.industry || '',
          metricoolBlogId: selectedClient?.metricool_blog_id || '',
          brandVoice: selectedClient?.brand_voice || '',
          captionLanguage: selectedClient?.caption_language || 'spanish',
          defaultCta: selectedClient?.default_cta || '',
          defaultHashtags: selectedClient?.default_hashtags || '',
          captionNotes: selectedClient?.caption_notes || '',
          suggestions: suggestions.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error generando caption')

      setGeneratedCaption(data.caption)
      setExamplesUsed(data.examplesUsed ?? 0)

      // Save to history
      saveToHistory({
        clientName: selectedClient?.name || '',
        platform,
        topic: videoTitle,
        caption: data.caption,
        ts: Date.now(),
      })

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

  const handleSendToDraft = async () => {
    if (!generatedCaption || sendingDraft) return
    setSendingDraft(true)
    try {
      const result = await sendCaptionToDraft(
        generatedCaption,
        selectedClientId || undefined,
        selectedClient?.platforms ?? undefined
      )
      if (result.error) {
        toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
      } else {
        setDraftSent(true)
        setTimeout(() => setDraftSent(false), 3000)
        toast({ title: 'Draft creado en Metricool', description: 'Aparecerá como borrador para revisar y programar' })
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear el draft', variant: 'destructive' })
    } finally {
      setSendingDraft(false)
    }
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

          <div className="space-y-2">
            <Label htmlFor="suggestions">Sugerencias para el caption <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea
              id="suggestions"
              placeholder="ej. Precio: $49.99, promoción válida hasta el 31 de mayo, mencionar que incluye instalación gratis, destacar que quedan pocos cupos..."
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">Agrega precios, promociones, ofertas o cualquier información específica que la IA debe incluir en el caption.</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {loading ? 'Generando...' : 'Generar Caption'}
            </Button>
            <Button variant="outline" onClick={() => { setSelectedClientId(''); setPlatform(''); setVideoTitle(''); setGeneratedCaption(''); setExamplesUsed(0); setSuggestions('') }}>
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
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Regenerar
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <CheckCheck className="mr-2 h-3.5 w-3.5 text-green-500" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
                {selectedClient?.metricool_blog_id && (
                  <Button size="sm" onClick={handleSendToDraft} disabled={sendingDraft || draftSent}>
                    {draftSent ? (
                      <><CheckCheck className="mr-2 h-3.5 w-3.5 text-green-400" />Draft Enviado</>
                    ) : sendingDraft ? (
                      <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />Enviando...</>
                    ) : (
                      <><Send className="mr-2 h-3.5 w-3.5" />Enviar a Metricool</>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              value={generatedCaption}
              onChange={(e) => setGeneratedCaption(e.target.value)}
              rows={12}
              className="font-mono text-sm resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Puedes editar el caption directamente antes de copiarlo.</p>
              {(() => {
                const limit = platform === 'Twitter/X' ? 280 : platform === 'LinkedIn' ? 3000 : 2200
                const len = generatedCaption.length
                const pct = len / limit
                return (
                  <span className={`text-xs font-mono ${pct > 1 ? 'text-red-500 font-bold' : pct > 0.85 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {len.toLocaleString()} / {limit.toLocaleString()}
                    {pct > 1 && ' ⚠ excede'}
                  </span>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {!generatedCaption && !loading && (
        <div className="text-center py-10 text-muted-foreground">
          <Sparkles className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p className="text-lg font-medium">Genera captions con IA</p>
          <p className="text-sm mt-1">Selecciona un cliente, escribe el título del video y presiona &quot;Generar Caption&quot;</p>
          <p className="text-xs mt-2 opacity-60">La IA aprende del estilo real de cada cliente en Metricool</p>
        </div>
      )}

      <CaptionHistoryPanel
        onReuse={(entry) => {
          if (entry.caption) setGeneratedCaption(entry.caption)
          if (entry.topic) setVideoTitle(entry.topic)
          if (entry.platform) setPlatform(entry.platform)
        }}
      />
    </div>
  )
}

export function CaptionGenerator() {
  return (
    <Suspense>
      <CaptionGeneratorInner />
    </Suspense>
  )
}
