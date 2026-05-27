'use client'

import { useState, useTransition } from 'react'
import type { ContentIdea, Client, ContentIdeaStatus } from '@/lib/supabase/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { updateIdeaStatus, deleteContentIdea } from '@/lib/actions/content-ideas'
import { useToast } from '@/lib/hooks/use-toast'
import {
  Film,
  Image as ImageIcon,
  LayoutGrid,
  Circle,
  MoreHorizontal,
  Trash2,
  Send,
  Copy,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Eye,
  Palette,
  PenTool,
  Hash,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_CONFIG = {
  R: { label: 'Reel', icon: Film, color: 'bg-pink-100 text-pink-700 border-pink-200' },
  P: { label: 'Post', icon: ImageIcon, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  C: { label: 'Carrusel', icon: LayoutGrid, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  S: { label: 'Story', icon: Circle, color: 'bg-amber-100 text-amber-700 border-amber-200' },
} as const

const STATUS_CONFIG: Record<ContentIdeaStatus, { label: string; color: string }> = {
  idea: { label: 'Idea', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  asignada: { label: 'Asignada', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  grabada: { label: 'Grabada', color: 'bg-green-100 text-green-700 border-green-200' },
  producida: { label: 'En producción', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  publicada: { label: 'Publicada', color: 'bg-green-100 text-green-700 border-green-200' },
  descartada: { label: 'Descartada', color: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
}

interface IdeaCardProps {
  idea: ContentIdea
  clients: Client[]
  onUpdate: (idea: ContentIdea) => void
  onDelete: (id: string) => void
  onAssign: () => void
}

export function IdeaCard({ idea, clients, onUpdate, onDelete, onAssign }: IdeaCardProps) {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [, startTransition] = useTransition()

  const clientName = idea.client?.name ?? clients.find((c) => c.id === idea.client_id)?.name ?? '—'
  const typeCfg = TYPE_CONFIG[idea.content_type]
  const statusCfg = STATUS_CONFIG[idea.status]
  const TypeIcon = typeCfg.icon
  const isAssignable = idea.status === 'idea'

  function handleStatusChange(status: ContentIdeaStatus) {
    startTransition(async () => {
      const result = await updateIdeaStatus(idea.id, status)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
        return
      }
      onUpdate({ ...idea, status })
      toast({ title: `Movida a "${STATUS_CONFIG[status].label}"` })
    })
  }

  function handleDelete() {
    if (!confirm('¿Eliminar esta idea?')) return
    startTransition(async () => {
      await deleteContentIdea(idea.id)
      onDelete(idea.id)
    })
  }

  async function copyBrief() {
    const text = [
      `# ${idea.title}`,
      `Cliente: ${clientName}`,
      `Tipo: ${typeCfg.label}`,
      idea.hook && `\n## Hook\n${idea.hook}`,
      idea.visual_brief && `\n## Visual\n${idea.visual_brief}`,
      idea.caption_angle && `\n## Caption Angle\n${idea.caption_angle}`,
      idea.hashtags_suggestion && `\n## Hashtags\n${idea.hashtags_suggestion}`,
      idea.rationale && `\n## Por qué\n${idea.rationale}`,
    ].filter(Boolean).join('\n')
    await navigator.clipboard.writeText(text)
    toast({ title: 'Brief copiado al portapapeles' })
  }

  return (
    <Card className={cn('flex flex-col', idea.status === 'descartada' && 'opacity-60')}>
      <CardHeader className="pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={cn('gap-1 text-[10px]', typeCfg.color)}>
                <TypeIcon className="h-3 w-3" />
                {typeCfg.label}
              </Badge>
              <Badge variant="outline" className={cn('text-[10px]', statusCfg.color)}>
                {statusCfg.label}
              </Badge>
            </div>
            <p className="text-sm font-semibold leading-snug">{idea.title}</p>
            <p className="text-xs text-muted-foreground">@ {clientName}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copyBrief}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copiar brief
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleStatusChange('idea')} disabled={idea.status === 'idea'}>
                <Lightbulb className="mr-2 h-3.5 w-3.5" /> Marcar como idea
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('descartada')} disabled={idea.status === 'descartada'}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Descartar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Eliminar permanentemente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {idea.hook && (
          <div className="rounded-md bg-amber-500/5 border border-amber-200 px-3 py-2">
            <p className="text-xs flex items-start gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
              <span className="font-medium text-amber-900">{idea.hook}</span>
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3 pt-0 flex-1 flex flex-col">
        {/* Visual brief — always visible because this is the designer-critical bit */}
        {idea.visual_brief && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Palette className="h-3 w-3" />
              Visual Brief
            </p>
            <p className="text-xs leading-relaxed">{idea.visual_brief}</p>
          </div>
        )}

        {/* Collapsible secondary fields */}
        {expanded && (
          <div className="space-y-3 pt-1 border-t border-border">
            {idea.caption_angle && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <PenTool className="h-3 w-3" />
                  Caption Angle
                </p>
                <p className="text-xs leading-relaxed">{idea.caption_angle}</p>
              </div>
            )}
            {idea.hashtags_suggestion && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Hashtags
                </p>
                <p className="text-xs leading-relaxed font-mono break-words">{idea.hashtags_suggestion}</p>
              </div>
            )}
            {idea.rationale && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Por qué esta idea
                </p>
                <p className="text-xs text-muted-foreground italic leading-relaxed">{idea.rationale}</p>
              </div>
            )}
          </div>
        )}

        {(idea.caption_angle || idea.hashtags_suggestion || idea.rationale) && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 self-start"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Ver menos' : 'Ver detalles'}
          </button>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 mt-auto pt-2">
          {isAssignable ? (
            <Button onClick={onAssign} size="sm" className="flex-1 h-8 gap-1.5">
              <Send className="h-3 w-3" />
              Asignar a producción
            </Button>
          ) : idea.status === 'asignada' || idea.status === 'producida' ? (
            <Badge variant="outline" className="flex-1 justify-center h-8 text-xs">
              En flujo de producción
            </Badge>
          ) : idea.status === 'publicada' ? (
            <Badge variant="outline" className="flex-1 justify-center h-8 text-xs border-green-300 text-green-700 bg-green-50">
              ✓ Publicada
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
