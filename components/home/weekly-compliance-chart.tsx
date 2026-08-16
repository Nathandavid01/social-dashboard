'use client'

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
import { COMPLIANCE_META, type WeeklyComplianceSummary } from '@/lib/utils/weekly-compliance-types'

type ChartDatum = {
  name: string
  Publicado: number
  Meta: number
  status: WeeklyComplianceSummary['clients'][number]['status']
}

/**
 * Extracted out of WeeklyComplianceCard (perf lote 1, #2): recharts is
 * ~300-400kB and this card mounts unconditionally on /home. The card loads
 * this module lazily via next/dynamic instead of importing recharts directly.
 */
export function WeeklyComplianceChart({
  chartData,
  chartHeight,
}: {
  chartData: ChartDatum[]
  chartHeight: number
}) {
  return (
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
  )
}
