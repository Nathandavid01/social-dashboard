'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Copy, CheckCheck, Search, Download } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import type { SavedCaption } from '@/lib/data/casita-vieja-captions'

interface SavedCaptionsViewProps {
  captions: SavedCaption[]
  clientName: string
}

const platformColors: Record<string, string> = {
  Facebook: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Instagram Reel': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  Instagram: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
}

export function SavedCaptionsView({ captions, clientName }: SavedCaptionsViewProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [page, setPage] = useState(1)
  const perPage = 12

  const platforms = useMemo(
    () => [...new Set(captions.map((c) => c.platform))],
    [captions]
  )

  const filtered = useMemo(() => {
    return captions.filter((c) => {
      if (platformFilter !== 'all' && c.platform !== platformFilter) return false
      if (search && !c.caption.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [captions, platformFilter, search])

  const paginated = filtered.slice(0, page * perPage)
  const hasMore = paginated.length < filtered.length

  const handleCopy = async (caption: SavedCaption) => {
    await navigator.clipboard.writeText(caption.caption)
    setCopiedId(caption.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast({ title: 'Caption copiado', description: 'Copiado al portapapeles' })
  }

  const handleCopyAll = async () => {
    const allText = filtered
      .map(
        (c, i) =>
          `--- Caption ${i + 1} (${c.platform} | ${c.date}) ---\n\n${c.caption}`
      )
      .join('\n\n\n')
    await navigator.clipboard.writeText(allText)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
    toast({
      title: 'Todos copiados',
      description: `${filtered.length} captions copiados al portapapeles`,
    })
  }

  const handleExportCSV = () => {
    const header = 'Platform,Date,Caption\n'
    const rows = filtered
      .map(
        (c) =>
          `"${c.platform}","${c.date}","${c.caption.replace(/"/g, '""')}"`
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${clientName.toLowerCase().replace(/\s+/g, '-')}-captions.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Exportado', description: 'CSV descargado' })
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en captions..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={platformFilter}
          onValueChange={(v) => {
            setPlatformFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ({captions.length})</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p} value={p}>
                {p} ({captions.filter((c) => c.platform === p).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleCopyAll}>
          {copiedAll ? (
            <CheckCheck className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copiedAll ? 'Copiado' : 'Copiar todos'}
        </Button>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} caption{filtered.length !== 1 ? 's' : ''} encontrado
        {filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Caption Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {paginated.map((caption) => (
          <Card key={caption.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={platformColors[caption.platform] ?? ''}
                >
                  {caption.platform}
                </Badge>
                <span className="text-xs text-muted-foreground">{caption.date}</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm whitespace-pre-line leading-relaxed line-clamp-6">
                {caption.caption}
              </p>
            </CardContent>
            <CardFooter className="pt-3 border-t flex items-center justify-between">
              <div className="flex gap-3 text-xs text-muted-foreground">
                {caption.reactions != null && caption.reactions > 0 && (
                  <span>{caption.reactions.toLocaleString()} reactions</span>
                )}
                {caption.likes != null && caption.likes > 0 && (
                  <span>{caption.likes.toLocaleString()} likes</span>
                )}
                {caption.views != null && caption.views > 0 && (
                  <span>{caption.views.toLocaleString()} views</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(caption)}
              >
                {copiedId === caption.id ? (
                  <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
            Cargar mas ({filtered.length - paginated.length} restantes)
          </Button>
        </div>
      )}
    </div>
  )
}
