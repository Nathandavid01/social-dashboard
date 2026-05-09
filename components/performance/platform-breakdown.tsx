'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const data = [
  { name: 'Instagram', value: 40, color: '#ec4899' },
  { name: 'Facebook', value: 25, color: '#3b82f6' },
  { name: 'TikTok', value: 20, color: '#94a3b8' },
  { name: 'LinkedIn', value: 15, color: '#0ea5e9' },
]

export function PlatformBreakdown() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Posts by Platform</CardTitle>
        <p className="text-xs text-muted-foreground">Mock data — connect Metricool API for live data</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value) => [`${value}%`, '']}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
