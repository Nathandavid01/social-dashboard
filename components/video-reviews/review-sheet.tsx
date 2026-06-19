'use client'

import { useState, useTransition, useEffect } from 'react'
import { updateVideoReview, deleteVideoReview } from '@/lib/actions/video-reviews'
import type { VideoReview } from '@/lib/supabase/types'
import { VIDEO_ERROR_TYPES } from '@/lib/supabase/types'
import { useToast } from '@/lib/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  MoreHorizontal,
  Trash2,
  Play,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { friendlyError } from '@/lib/utils/error-message'

const STATUS_CONFIG = {
  submitted: { label: 'Pendiente', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  head_editor_review: { label: 'En Revisión', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200' },
  pending_final_check: { label: 'En Revisión', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200' },
  final_check_review: { label: 'En Revisión', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200' },
  revision_needed: { label: 'Necesita Cambios', color: 'bg-red-500/10 text-red-600 border-red-200' },
  approved: { label: 'Aprobado', color: 'bg-green-500/10 text-green-600 border-green-200' },
}

interface ReviewSheetProps {
  review: VideoReview | null
  open: boolean
  onClose: () => void
}

export function ReviewSheet({ review, open, onClose }: ReviewSheetProps) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const [selectedErrors, setSelectedErrors] = useState<string[]>([])
  const [errorNotes, setErrorNotes] = useState('')
  const [generalNotes, setGeneralNotes] = useState('')

  useEffect(() => {
    if (review) {
      setSelectedErrors(review.errors ?? [])
      setErrorNotes(review.error_notes ?? '')
      setGeneralNotes(review.general_notes ?? '')
    }
  }, [review])

  function toggleError(slug: string) {
    setSelectedErrors((prev) =>
      prev.includes(slug) ? prev.filter((e) => e !== slug) : [...prev, slug]
    )
  }

  function handleStatusChange(status: string, friendlyMsg?: string) {
    if (!review) return
    startTransition(async () => {
      const result = await updateVideoReview(review.id, {
        status,
        errors: selectedErrors,
        error_notes: errorNotes || null,
        general_notes: generalNotes || null,
      })
      if (result.error) {
        toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
      } else {
        toast({ title: friendlyMsg ?? 'Estado actualizado' })
        if (status === 'approved' || status === 'revision_needed') onClose()
      }
    })
  }

  function handleSave() {
    if (!review) return
    startTransition(async () => {
      const result = await updateVideoReview(review.id, {
        errors: selectedErrors,
        error_notes: errorNotes || null,
        general_notes: generalNotes || null,
      })
      if (result.error) {
        toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
      } else {
        toast({ title: 'Notas guardadas' })
      }
    })
  }

  function handleDelete() {
    if (!review || !confirm('¿Eliminar esta revisión de video?')) return
    startTransition(async () => {
      await deleteVideoReview(review.id)
      onClose()
    })
  }

  if (!review) return null

  const statusCfg = STATUS_CONFIG[review.status]
  const hasErrors = selectedErrors.length > 0

  // Anyone can review — no role gates
  const canReview = review.status !== 'approved'

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pr-8">
          <div className="flex items-start justify-between gap-2">
            <SheetTitle className="leading-snug text-base">{review.title}</SheetTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', statusCfg.color)}>
              {statusCfg.label}
            </span>
            {review.client && (
              <span className="text-xs text-muted-foreground">
                @ {(review.client as { name: string }).name}
              </span>
            )}
            {review.revision_count > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <RotateCcw className="h-3 w-3" />
                {review.revision_count} revision{review.revision_count !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-6">
          {/* Drive link */}
          <a
            href={review.drive_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 hover:bg-primary/10 transition-colors group"
          >
            <Play className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium flex-1 truncate">{review.drive_link}</span>
            <ExternalLink className="h-4 w-4 text-primary opacity-60 group-hover:opacity-100 shrink-0" />
          </a>

          {/* People info */}
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {review.editor && (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>Enviado por <strong className="text-foreground">{(review.editor as { full_name: string }).full_name}</strong></span>
              </div>
            )}
            {review.head_editor && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-yellow-500" />
                <span>Aprobado por Head Editor: <strong className="text-foreground">{(review.head_editor as { full_name: string }).full_name}</strong></span>
              </div>
            )}
            {review.final_reviewer && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span>Aprobado en Final Check: <strong className="text-foreground">{(review.final_reviewer as { full_name: string }).full_name}</strong></span>
              </div>
            )}
          </div>

          {/* Error checklist */}
          <div>
            <p className="text-sm font-semibold mb-3">Checklist de Errores</p>
            <div className="grid grid-cols-2 gap-2">
              {VIDEO_ERROR_TYPES.map((et) => {
                const checked = selectedErrors.includes(et.slug)
                return (
                  <button
                    key={et.slug}
                    type="button"
                    onClick={() => toggleError(et.slug)}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                      checked
                        ? 'border-red-400 bg-red-500/10 text-red-600 font-medium'
                        : 'border-border hover:bg-muted/50 text-muted-foreground'
                    )}
                  >
                    <span className={cn('h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      checked ? 'border-red-500 bg-red-500' : 'border-muted-foreground/40'
                    )}>
                      {checked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                    </span>
                    {et.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Error notes (shown when errors selected) */}
          {hasErrors && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-red-600">Detalles de Errores</p>
              <Textarea
                placeholder="Describe los errores específicos, timestamps, etc..."
                value={errorNotes}
                onChange={(e) => setErrorNotes(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
          )}

          {/* General notes */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Notas Generales</p>
            <Textarea
              placeholder="Feedback general, elogios, contexto..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pb-4">
            <Button
              className="w-full"
              variant="outline"
              onClick={handleSave}
              disabled={isPending}
            >
              Guardar Notas
            </Button>

            {canReview && (
              <div className="flex gap-2">
                {hasErrors ? (
                  <Button
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    variant="outline"
                    onClick={() => handleStatusChange('revision_needed', 'Video devuelto para cambios')}
                    disabled={isPending}
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Pedir Cambios
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleStatusChange('approved', '🎉 Video aprobado')}
                    disabled={isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Aprobar Video
                  </Button>
                )}
              </div>
            )}

            {review.status === 'approved' && (
              <p className="text-xs text-center text-green-600 font-medium pt-1">✓ Este video ya fue aprobado</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
