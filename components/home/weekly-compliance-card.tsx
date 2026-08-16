'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Target, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  COMPLIANCE_META,
  type WeeklyComplianceSummary,
} from '@/lib/utils/weekly-compliance-types'

// recharts (~300-400kB) loaded lazily: /home shouldn't pay for it in the
// initial JS bundle (see weekly-compliance-chart.tsx). The wrapper below owns
// the height so the skeleton reserves the exact space the chart will fill —
// no layout jump once it loads.
const WeeklyComplianceChart = dynamic(
  () => import('./weekly-compliance-chart').then((m) => m.WeeklyComplianceChart),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
)

export function WeeklyComplianceCard({ data }: { data: WeeklyComplianceSummary }) {
  const router = useRouter()
  const [live, setLive] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live updates. The published counts come from Metricool, which is polled
  // (cached ~5 min upstream), so we re-fetch the server data on an interval to
  // reflect newly published posts. We ALSO listen to Supabase Realtime on
  // content_ideas / activity so internal changes (and quota edits surfacing
  // through a publish) refresh promptly. Both paths debounce into one refresh.
  useEffect(() => {
    const supabase = createClient()
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => router.refresh(), 1200)
    }

    const channel = supabase
      .channel('weekly-compliance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_ideas' }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'content_idea_activity' }, scheduleRefresh)
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    // Poll Metricool-backed data every 5 min (matches upstream revalidate).
    const poll = setInterval(() => router.refresh(), 5 * 60 * 1000)

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [router])

  const withQuota = useMemo(
    () => data.clients.filter((c) => c.quota !== null),
    [data.clients],
  )
  const noQuota = useMemo(
    () => data.clients.filter((c) => c.quota === null),
    [data.clients],
  )

  const chartData = useMemo(
    () =>
      withQuota.map((c) => ({
        name: c.clientName,
        Publicado: c.published,
        Meta: c.quota ?? 0,
        status: c.status,
      })),
    [withQuota],
  )

  const behind = withQuota.filter((c) => c.status === 'atrasado' || c.status === 'sin_empezar').length
  const done = withQuota.filter((c) => c.status === 'completo').length
  const chartHeight = Math.max(180, chartData.length * 38 + 30)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <Target className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Cumplimiento semanal por cliente</span>
            {live && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                <Radio className="h-2.5 w-2.5 animate-pulse" /> En vivo
              </span>
            )}
          </CardTitle>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            {data.totalPublished}/{data.totalQuota} publicados (Metricool) · {done} al 100% · {behind} atrasados
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún cliente activo tiene cuota semanal configurada. Define los “posts por semana”
            en la pestaña Contrato de cada cliente.
          </p>
        ) : (
          <>
            <div style={{ height: chartHeight }}>
              <WeeklyComplianceChart chartData={chartData} chartHeight={chartHeight} />
            </div>

            {/* Per-client status list with badges */}
            <ul className="space-y-1.5">
              {withQuota.map((c) => {
                const meta = COMPLIANCE_META[c.status]
                return (
                  <li key={c.clientId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot)} />
                      <span className="truncate">{c.clientName}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                      <span className="tabular-nums text-muted-foreground">
                        {c.published}/{c.quota}
                      </span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', meta.badge)}>
                        {meta.label}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {noQuota.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Sin cuota configurada: {noQuota.map((c) => c.clientName).join(', ')}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
