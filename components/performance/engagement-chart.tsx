'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, subDays } from 'date-fns'

// Generate mock data for the last 30 days
function generateMockData() {
  return Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i)
    return {
      date: format(date, 'MMM d'),
      Instagram: Math.floor(Math.random() * 500 + 100),
      Facebook: Math.floor(Math.random() * 300 + 50),
      TikTok: Math.floor(Math.random() * 800 + 200),
      LinkedIn: Math.floor(Math.random() * 200 + 30),
    }
  })
}

const PLATFORM_COLORS = {
  Instagram: '#ec4899',
  Facebook: '#3b82f6',
  TikTok: '#94a3b8',
  LinkedIn: '#0ea5e9',
}

export function EngagementChart() {
  const data = generateMockData()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Engagement Over Time (30 days)</CardTitle>
        <p className="text-xs text-muted-foreground">Mock data — connect Metricool API for live data</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              interval={6}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
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
            {Object.entries(PLATFORM_COLORS).map(([key, color]) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
