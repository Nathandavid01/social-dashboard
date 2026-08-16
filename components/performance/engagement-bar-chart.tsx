'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#ec4899',
  facebook: '#3b82f6',
  tiktok: '#94a3b8',
  linkedin: '#0ea5e9',
}

/**
 * Extracted out of EngagementChart (perf lote 1, #2): recharts loaded lazily
 * via next/dynamic instead of shipping in /performance's initial JS.
 */
export function EngagementBarChart({
  data,
  platforms,
}: {
  data: Array<Record<string, string | number>>
  platforms: string[]
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          interval={1}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {platforms.length > 0 ? (
          platforms.map((p) => (
            <Bar key={p} dataKey={p} stackId="a" fill={PLATFORM_COLORS[p]} radius={[0, 0, 0, 0]} />
          ))
        ) : (
          <Bar dataKey="total" fill="hsl(var(--primary))" />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
