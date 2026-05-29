'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  COMPLIANCE_META,
  type WeeklyComplianceSummary,
} from '@/lib/utils/weekly-compliance-types'

export function WeeklyComplianceCard({ data }: { data: WeeklyComplianceSummary }) {
  const router = useRouter()
  const [live, setLive] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live updates: whenever a content_idea changes (e.g. marked 'publicada')
  // or an activity row lands, re-fetch the server data. Debounced so a burst
  // of changes triggers a single refresh.
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

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
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
            {data.totalPublished}/{data.totalQuota} posts · {done} al 100% · {behind} atrasados
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
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Meta" fill="hsl(var(--muted))" radius={[0, 3, 3, 0]} barSize={9} />
                <Bar dataKey="Publicado" radius={[0, 3, 3, 0]} barSize={9}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={COMPLIANCE_META[d.status].bar} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

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
