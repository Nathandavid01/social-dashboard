'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles, RefreshCw, CheckCircle, XCircle, Clock, Zap,
  ExternalLink, ChevronDown, ChevronUp, Copy, CheckCheck, Film,
} from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import Link from 'next/link'

interface VideoReviewItem {
  id: string
  title: string
  drive_link: string
  status: string
  client?: { id: string; name: string } | null
  updated_at: string
}

interface ProcessResult {
  success: boolean
  videoReviewId: string
  videoTitle: string
  caption?: string
  metricoolPostId?: string | number
  error?: string
}

export function AutomationPanel() {
  const { toast } = useToast()
  const [reviews, setReviews] = useState<VideoReviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [results, setResults] = useState<ProcessResult[]>([])
  const [expandedResult, setExpandedResult] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyCaption = async (id: string, caption: string) => {
    await navigator.clipboard.writeText(caption)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast({ title: 'Caption copiado al portapapeles' })
  }

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/automation/process-queue')
      const data = await res.json()
      setReviews(data.reviews || [])
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la cola de videos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchQueue() }, [])

  const processOne = async (reviewId: string, title: string) => {
    setProcessing(reviewId)
    try {
      const res = await fetch('/api/automation/process-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_review_id: reviewId }),
      })
      const result: ProcessResult = await res.json()
      setResults((prev) => [result, ...prev.filter((r) => r.videoReviewId !== reviewId)])
      if (result.success) {
        setExpandedResult(reviewId)
        toast({ title: 'Caption generado ✓', description: `"${title}" → Borrador en Metricool` })
      } else {
        toast({ title: 'Error', description: result.error || 'Falló la generación', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Request failed', variant: 'destructive' })
    } finally {
      setProcessing(null)
    }
  }

  const processAll = async () => {
    setProcessing('all')
    try {
      const res = await fetch('/api/automation/process-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      const newResults: ProcessResult[] = data.results || []
      setResults((prev) => [...newResults, ...prev])
      const success = newResults.filter((r) => r.success).length
      toast({ title: `${success}/${newResults.length} captions generados`, description: 'Enviados a Metricool como borradores' })
    } catch {
      toast({ title: 'Error', description: 'Failed to process queue', variant: 'destructive' })
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Videos Aprobados</p>
                <p className="text-2xl font-bold">{reviews.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Captions generados</p>
                <p className="text-2xl font-bold">{results.filter((r) => r.success).length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Errores</p>
                <p className="text-2xl font-bold">{results.filter((r) => !r.success).length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Video Queue — approved video reviews */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Film className="h-4 w-4 text-primary" />
                Videos Aprobados — Listos para Caption
              </CardTitle>
              <CardDescription>
                Videos que pasaron QC y están listos para generar caption con IA
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading}>
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {reviews.length > 0 && (
                <Button size="sm" onClick={processAll} disabled={!!processing}>
                  {processing === 'all'
                    ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                    : <Zap className="mr-2 h-3.5 w-3.5" />
                  }
                  Procesar Todo
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Film className="mx-auto h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No hay videos aprobados pendientes de caption</p>
              <p className="text-xs mt-1 opacity-60">
                Cuando un video sea aprobado en{' '}
                <Link href="/video-reviews" className="text-primary hover:underline">Video QC</Link>
                , aparecerá aquí
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {reviews.map((review) => {
                const result = results.find((r) => r.videoReviewId === review.id)
                const isProcessing = processing === review.id
                return (
                  <div key={review.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {result?.success
                        ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        : result?.error
                          ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      }
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{review.title}</p>
                          {review.drive_link && (
                            <a href={review.drive_link} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 text-muted-foreground hover:text-primary">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {review.client && (
                          <p className="text-xs text-primary font-medium">{review.client.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {result?.success && (
                        <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-xs">
                          Caption listo
                        </Badge>
                      )}
                      {!result?.success && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => processOne(review.id, review.title)}
                          disabled={!!processing}
                        >
                          {isProcessing
                            ? <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                            : <Sparkles className="mr-2 h-3 w-3" />
                          }
                          {isProcessing ? 'Generando...' : 'Generar'}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results log */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Captions generados esta sesión</CardTitle>
            <CardDescription>Revisa y aprueba antes de publicar en Metricool</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result) => {
                const isExpanded = expandedResult === result.videoReviewId
                return (
                  <div key={result.videoReviewId} className="rounded-lg border overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedResult(isExpanded ? null : result.videoReviewId)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {result.success
                          ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                          : <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        }
                        <p className="text-sm font-medium truncate">{result.videoTitle}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={result.success
                          ? 'text-green-500 border-green-500/30 bg-green-500/10 text-xs'
                          : 'text-red-500 border-red-500/30 bg-red-500/10 text-xs'
                        }>
                          {result.success ? 'Listo' : 'Error'}
                        </Badge>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t pt-3">
                        {result.caption && (
                          <div className="rounded-md bg-muted/50 p-3 relative group">
                            <p className="text-sm whitespace-pre-line leading-relaxed pr-8">{result.caption}</p>
                            <button
                              onClick={() => copyCaption(result.videoReviewId, result.caption!)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            >
                              {copiedId === result.videoReviewId
                                ? <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                                : <Copy className="h-3.5 w-3.5" />
                              }
                            </button>
                          </div>
                        )}
                        {result.error && (
                          <p className="text-xs text-red-500 bg-red-500/10 rounded px-3 py-2">{result.error}</p>
                        )}
                        {result.metricoolPostId && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Borrador creado en Metricool
                            <a href="https://app.metricool.com" target="_blank" rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-0.5 ml-1">
                              Abrir Metricool <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
