'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarDays, ArrowRight, ImageIcon } from 'lucide-react'
import type { PublishedPost } from '@/app/api/metricool/posts/route'

const networkEmoji: Record<string, string> = {
  instagram: '📸',
  facebook: '👥',
  tiktok: '🎵',
  linkedin: '💼',
  twitter: '𝕏',
  youtube: '▶️',
}

function formatDateTime(dateStr: string) {
  try {
    const d = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const isTomorrow = d.toDateString() === tomorrow.toDateString()
    const dayLabel = isTomorrow ? 'Mañana' : d.toLocaleDateString('es-PR', { weekday: 'short', month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${dayLabel} · ${time}`
  } catch { return dateStr }
}

export function UpcomingSchedule() {
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch next 7 days of scheduled posts
    fetch(`/api/metricool/posts?all=true&range=7d`)
      .then((r) => r.json())
      .then((data) => {
        const now = new Date()
        const upcoming = (data.posts || [])
          .filter((p: PublishedPost) => new Date(p.publicationDate) > now)
          .sort((a: PublishedPost, b: PublishedPost) => a.publicationDate.localeCompare(b.publicationDate))
          .slice(0, 12)
        setPosts(upcoming)
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  // Group by date
  const grouped = posts.reduce((acc, post) => {
    const date = post.publicationDate.slice(0, 10)
    if (!acc[date]) acc[date] = []
    acc[date].push(post)
    return acc
  }, {} as Record<string, PublishedPost[]>)

  const dates = Object.keys(grouped).sort()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Próximos 7 Días
          </CardTitle>
          {!loading && posts.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 bg-yellow-500/10 text-xs">
                {posts.length} programados
              </Badge>
              <Link href="/published?tab=calendar" className="text-muted-foreground hover:text-primary transition-colors">
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarDays className="mx-auto h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No hay contenido programado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dates.map((date) => {
              const dayPosts = grouped[date]
              const d = new Date(date + 'T12:00:00')
              const dayLabel = d.toLocaleDateString('es-PR', { weekday: 'short', month: 'short', day: 'numeric' })
              return (
                <div key={date}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    {dayLabel} · {dayPosts.length} post{dayPosts.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-1.5">
                    {dayPosts.slice(0, 3).map((post) => (
                      <div key={post.id} className="flex items-center gap-2.5 rounded-lg border bg-muted/20 p-2.5">
                        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {post.media?.[0]?.url ? (
                            <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {post.clientName && (
                              <span className="text-xs font-semibold text-primary">{post.clientName}</span>
                            )}
                            {post.platforms.map((p) => (
                              <span key={p} className="text-[10px]">{networkEmoji[p] ?? p}</span>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate leading-relaxed">
                            {post.text || '(sin texto)'}
                          </p>
                        </div>
                        <span className="text-[10px] text-yellow-500 font-medium shrink-0">
                          {new Date(post.publicationDate).toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="text-[10px] text-muted-foreground pl-1">+{dayPosts.length - 3} más este día</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
