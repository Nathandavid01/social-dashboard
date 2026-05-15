import { NextResponse } from 'next/server'

interface MetricoolBlog {
  id: number
  name: string
  url?: string
  provider?: string
}

export async function GET() {
  const token = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID

  if (!token || !userId) {
    return NextResponse.json({ error: 'Metricool not configured' }, { status: 500 })
  }

  try {
    const url = `https://app.metricool.com/api/v2/brands?userId=${userId}`
    const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Metricool error: ${res.status} ${text}` }, { status: 500 })
    }

    const json = await res.json() as { data?: MetricoolBlog[] }
    const blogs = (json.data || []).map((b) => ({
      id: String(b.id),
      name: b.name,
      url: b.url || '',
    }))

    return NextResponse.json({ blogs })
  } catch (error) {
    console.error('Metricool blogs fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch blogs' }, { status: 500 })
  }
}
