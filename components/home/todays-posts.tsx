'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarClock, ImageIcon, ArrowRight } from 'lucide-react'
import type { PublishedPost } from '@/app/api/metricool/posts/route'

const networkEmoji: Record<string, string> = {
  instagram: '📸',
  facebook: '👥',
  tiktok: '🎵',
  linkedin: '💼',
  twitter: '𝕏',
  youtube: '▶️',
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('es-PR', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch { return dateStr }
}

export function TodaysPosts() {
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/metricool/posts?all=true&today=true`)
      .then((r) => r.json())
      .then((data) => setPosts((data.posts || []).slice(0, 20)))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const published = posts.filter((p) => new Date(p.publicationDate) <= now)
  const upcoming = posts.filter((p) => new Date(p.publicationDate) > now)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Contenido de Hoy</span>
          </CardTitle>
          {!loading && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="whitespace-nowrap border-green-500/30 bg-green-500/10 text-xs text-green-500">
                {published.length} pub.
              </Badge>
              <Badge variant="outline" className="whitespace-nowrap border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-500">
                {upcoming.length} prog.
              </Badge>
              <Link href="/published" className="text-muted-foreground transition-colors hover:text-primary" aria-label="Ver todos">
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarClock className="mx-auto h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No hay contenido programado para hoy</p>
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => {
              const isPublished = new Date(post.publicationDate) <= now
              return (
                <div key={post.id} className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {post.media?.[0]?.url ? (
                      <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground opacity-40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      {post.clientName && (
                        <span className="text-xs font-semibold text-primary">{post.clientName}</span>
                      )}
                      <span className={`text-xs font-medium ${isPublished ? 'text-green-500' : 'text-yellow-500'}`}>
                        {formatTime(post.publicationDate)}
                      </span>
                      {post.platforms.map((p) => (
                        <span key={p} className="text-[10px]">{networkEmoji[p] ?? p}</span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                      {post.text || '(sin texto)'}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${isPublished
                      ? 'text-green-500 border-green-500/30 bg-green-500/10'
                      : 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10'}`}
                  >
                    {isPublished ? 'Publicado' : 'Pendiente'}
                  </Badge>
                </div>
              )
            })}
            {posts.length > 0 && (() => {
              const platformCounts = posts.reduce((acc, p) => {
                p.platforms.forEach((pl) => { acc[pl] = (acc[pl] ?? 0) + 1 })
                return acc
              }, {} as Record<string, number>)
              return (
                <div className="mt-3 pt-3 border-t flex items-center gap-1.5 flex-wrap">
                  {Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).map(([p, count]) => (
                    <span key={p} className="text-[10px] text-muted-foreground">
                      {networkEmoji[p] ?? p} {count}
                    </span>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
