import { NextResponse } from 'next/server'

interface MetricoolSimpleProfile {
  id: number
  label: string | null
  url: string | null
  picture: string | null
  instagram: string | null
  facebook: string | null
  tiktok: string | null
  deleted: boolean | null
}

export async function GET() {
  const token = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID

  if (!token) {
    return NextResponse.json({ error: 'Metricool not configured (falta METRICOOL_TOKEN)' }, { status: 500 })
  }

  try {
    // /v2/brands was deprecated; current endpoint is /admin/simpleProfiles
    // userId is optional — the token alone is enough to identify the account.
    const url = `https://app.metricool.com/api/admin/simpleProfiles${userId ? `?userId=${userId}` : ''}`
    const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Metricool error: ${res.status} ${text}` }, { status: 500 })
    }

    // Response is a plain array of profiles.
    const json = (await res.json()) as MetricoolSimpleProfile[] | { data?: MetricoolSimpleProfile[] }
    const list = Array.isArray(json) ? json : (json.data ?? [])

    const blogs = list
      .filter((b) => !b.deleted)
      .map((b) => ({
        id: String(b.id),
        name: b.label ?? `Blog ${b.id}`,
        url: b.url ?? '',
        picture: b.picture ?? null,
        networks: [
          b.instagram ? 'instagram' : null,
          b.facebook ? 'facebook' : null,
          b.tiktok ? 'tiktok' : null,
        ].filter(Boolean) as string[],
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ blogs })
  } catch (error) {
    console.error('Metricool blogs fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch blogs' }, { status: 500 })
  }
}
