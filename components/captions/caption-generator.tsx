'use client'

import { useState } from 'react'
import { mockupCaptions, type CaptionExample } from '@/lib/data/mockup-captions'
import { CaptionCard } from './caption-card'
import { CaptionFilters } from './caption-filters'
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
import { Sparkles, Copy, CheckCheck } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'

const industries = [...new Set(mockupCaptions.map((c) => c.industry))]
const platforms = ['Instagram', 'TikTok', 'Facebook', 'Twitter/X'] as const
const captionTypes = ['promotional', 'engagement', 'educational', 'testimonial', 'announcement'] as const

const typeLabels: Record<string, string> = {
  promotional: 'Promocional',
  engagement: 'Engagement',
  educational: 'Educativo',
  testimonial: 'Testimonio',
  announcement: 'Anuncio',
}

export function CaptionGenerator() {
  const { toast } = useToast()
  const [clientName, setClientName] = useState('')
  const [industry, setIndustry] = useState('')
  const [platform, setPlatform] = useState('')
  const [captionType, setCaptionType] = useState('')
  const [topic, setTopic] = useState('')
  const [generatedCaptions, setGeneratedCaptions] = useState<CaptionExample[]>([])
  const [filterIndustry, setFilterIndustry] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [copiedAll, setCopiedAll] = useState(false)

  const handleGenerate = () => {
    // Filter mockup captions based on selections, or show all if no filters
    let results = [...mockupCaptions]

    if (industry) {
      results = results.filter((c) => c.industry === industry)
    }
    if (platform) {
      results = results.filter((c) => c.platform === platform)
    }
    if (captionType) {
      results = results.filter((c) => c.type === captionType)
    }

    // If we have specific filters that narrow results too much, fall back to type-matched or all
    if (results.length === 0) {
      results = mockupCaptions.filter((c) => {
        if (captionType) return c.type === captionType
        if (platform) return c.platform === platform
        return true
      })
    }

    // Replace client names in captions if user provided one
    if (clientName) {
      results = results.map((c) => ({
        ...c,
        client: clientName,
      }))
    }

    setGeneratedCaptions(results)
    toast({
      title: 'Captions generados',
      description: `${results.length} caption${results.length !== 1 ? 's' : ''} listo${results.length !== 1 ? 's' : ''} para exportar`,
    })
  }

  const handleCopyAll = async () => {
    const allText = filteredCaptions
      .map((c, i) => `--- Caption ${i + 1} (${c.client} | ${c.platform} | ${typeLabels[c.type]}) ---\n\n${c.caption}`)
      .join('\n\n\n')

    await navigator.clipboard.writeText(allText)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
    toast({
      title: 'Copiado',
      description: `${filteredCaptions.length} captions copiados al portapapeles`,
    })
  }

  // Apply view filters to generated captions
  const filteredCaptions = generatedCaptions.filter((c) => {
    if (filterIndustry !== 'all' && c.industry !== filterIndustry) return false
    if (filterPlatform !== 'all' && c.platform !== filterPlatform) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Generator Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="client">Nombre del cliente</Label>
              <Input
                id="client"
                placeholder="ej. Brisa Salon"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Industria</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar industria" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
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
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de caption</Label>
              <Select value={captionType} onValueChange={setCaptionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {captionTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {typeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="topic">Tema o descripcion del post (opcional)</Label>
            <Textarea
              id="topic"
              placeholder="ej. Promocion de verano, nuevo servicio, testimonio de cliente..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
            />
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleGenerate}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generar Captions
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setClientName('')
                setIndustry('')
                setPlatform('')
                setCaptionType('')
                setTopic('')
                setGeneratedCaptions([])
              }}
            >
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {generatedCaptions.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">
                Resultados ({filteredCaptions.length})
              </h2>
              <CaptionFilters
                filterIndustry={filterIndustry}
                filterPlatform={filterPlatform}
                onIndustryChange={setFilterIndustry}
                onPlatformChange={setFilterPlatform}
                industries={industries}
              />
            </div>
            <Button variant="outline" onClick={handleCopyAll} disabled={filteredCaptions.length === 0}>
              {copiedAll ? (
                <CheckCheck className="mr-2 h-4 w-4 text-green-500" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copiedAll ? 'Copiado' : 'Copiar todos'}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCaptions.map((caption) => (
              <CaptionCard key={caption.id} caption={caption} />
            ))}
          </div>

          {filteredCaptions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No hay captions que coincidan con los filtros seleccionados.
            </div>
          )}
        </>
      )}

      {generatedCaptions.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Sparkles className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p className="text-lg font-medium">Genera captions para tus clientes</p>
          <p className="text-sm mt-1">Selecciona los filtros arriba y presiona &quot;Generar Captions&quot;</p>
        </div>
      )}
    </div>
  )
}
