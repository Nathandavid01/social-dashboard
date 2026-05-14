'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getStoredConfig,
  clearConfig,
  getProfiles,
  getPosts,
  getStatsAggregation,
  formatDateParam,
  type PublicBlog,
  type PublicPost,
} from '@/lib/metricool/client'
import { useToast } from '@/lib/hooks/use-toast'
import {
  RefreshCw,
  Unplug,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
} from 'lucide-react'

interface MetricoolDashboardProps {
  onDisconnect: () => void
}

type DateRange = '7d' | '30d' | '90d'

function getDateRange(range: DateRange): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  switch (range) {
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      break
    case '90d':
      start.setDate(start.getDate() - 90)
      break
  }
  return { start: formatDateParam(start), end: formatDateParam(end) }
}

const platformColors: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  facebook: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  twitter: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  tiktok: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  linkedin: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  youtube: 'bg-red-500/10 text-red-500 border-red-500/20',
}

export function MetricoolDashboard({ onDisconnect }: MetricoolDashboardProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [profiles, setProfiles] = useState<PublicBlog[]>([])
  const [posts, setPosts] = useState<PublicPost[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const config = getStoredConfig()
    if (!config) return

    setLoading(true)
    setError(null)

    const { start, end } = getDateRange(dateRange)

    try {
      const [profilesData, postsData, statsData] = await Promise.allSettled([
        getProfiles(config),
        getPosts(config, start, end),
        getStatsAggregation(config, 'instagram', start, end),
      ])

      if (profilesData.status === 'fulfilled') setProfiles(profilesData.value)
      if (postsData.status === 'fulfilled') setPosts(postsData.value)
      if (statsData.status === 'fulfilled') setStats(statsData.value)

      const allRejected = [profilesData, postsData, statsData].every(
        (r) => r.status === 'rejected'
      )
      if (allRejected) {
        throw new Error('No se pudo conectar con Metricool. Verifica tus credenciales.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDisconnect = () => {
    clearConfig()
    onDisconnect()
    toast({ title: 'Desconectado', description: 'Metricool ha sido desconectado' })
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">
            Conectado
          </Badge>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="90d">Ultimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDisconnect}>
            <Unplug className="mr-2 h-3.5 w-3.5" />
            Desconectar
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Perfiles"
          value={profiles.length}
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="Posts"
          value={posts.length}
          icon={TrendingUp}
          loading={loading}
        />
        <StatCard
          title="Impresiones"
          value={stats.impressions ?? stats.totalImpressions ?? 0}
          icon={Eye}
          loading={loading}
          format
        />
        <StatCard
          title="Engagement"
          value={stats.engagement ?? stats.totalEngagement ?? 0}
          icon={Heart}
          loading={loading}
          format
        />
      </div>

      {/* Profiles */}
      {profiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perfiles conectados</CardTitle>
            <CardDescription>{profiles.length} perfil{profiles.length !== 1 ? 'es' : ''} en tu cuenta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profiles.map((profile, i) => (
                <div key={profile.id ?? i} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {profile.picture ? (
                      <img
                        src={profile.picture}
                        alt={profile.name}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {profile.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{profile.name}</p>
                      {profile.url && (
                        <p className="text-xs text-muted-foreground">{profile.url}</p>
                      )}
                    </div>
                  </div>
                  {profile.provider && (
                    <Badge
                      variant="outline"
                      className={platformColors[profile.provider.toLowerCase()] ?? ''}
                    >
                      {profile.provider}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Posts */}
      {posts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posts recientes</CardTitle>
            <CardDescription>
              {posts.length} post{posts.length !== 1 ? 's' : ''} en el periodo seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {posts.slice(0, 20).map((post, i) => (
                <div key={post.id ?? i} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm line-clamp-2">{post.text || '(sin texto)'}</p>
                    <Badge
                      variant="outline"
                      className={platformColors[post.provider?.toLowerCase()] ?? ''}
                    >
                      {post.provider}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="text-xs">{post.date}</span>
                    {post.likes != null && (
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" /> {post.likes.toLocaleString()}
                      </span>
                    )}
                    {post.comments != null && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> {post.comments.toLocaleString()}
                      </span>
                    )}
                    {post.shares != null && (
                      <span className="flex items-center gap-1">
                        <Share2 className="h-3 w-3" /> {post.shares.toLocaleString()}
                      </span>
                    )}
                    {post.impressions != null && (
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {post.impressions.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && profiles.length === 0 && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p className="text-lg font-medium">No se encontraron datos</p>
          <p className="text-sm mt-1">Intenta con un rango de fechas diferente</p>
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  format,
}: {
  title: string
  value: number
  icon: React.ElementType
  loading: boolean
  format?: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold">
                {format ? value.toLocaleString() : value}
              </p>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
