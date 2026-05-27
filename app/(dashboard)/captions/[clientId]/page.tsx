import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { SavedCaptionsView, type SavedCaption } from '@/components/captions/saved-captions-view'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  threads: 'Threads',
}

interface MetricoolPostsResponse {
  data?: {
    id: number
    uuid: string
    text: string
    publicationDate?: { dateTime: string }
    providers?: { network: string }[]
    draft?: boolean
  }[]
}

type FetchResult =
  | { ok: true; captions: SavedCaption[] }
  | { ok: false; error: string }

async function fetchClientCaptions(blogId: string, clientName: string): Promise<FetchResult> {
  const token = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!token || !userId) {
    return { ok: false, error: 'Metricool credentials no están configuradas en el servidor' }
  }

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 90)
  const startStr = start.toISOString().slice(0, 19)
  const endStr = end.toISOString().slice(0, 19)

  const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${blogId}&start=${startStr}&end=${endStr}`
  try {
    const res = await fetch(url, {
      headers: { 'X-Mc-Auth': token },
      next: { revalidate: 60 },
    })
    if (!res.ok) {
      return { ok: false, error: `Metricool respondió ${res.status} — verifica que el blog ID exista` }
    }

    const json = (await res.json()) as MetricoolPostsResponse
    const captions = (json.data ?? [])
      .filter((p) => !p.draft && p.text)
      .map((p) => ({
        id: p.uuid || p.id,
        client: clientName,
        platform: (p.providers ?? [])
          .map((x) => PLATFORM_LABEL[x.network?.toLowerCase()] ?? x.network)
          .join(', ') || '—',
        date: p.publicationDate?.dateTime?.replace('T', ' ') ?? '',
        caption: p.text,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
    return { ok: true, captions }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { ok: false, error: `No se pudo contactar a Metricool: ${message}` }
  }
}

export default async function ClientCaptionsPage({
  params,
}: {
  params: { clientId: string }
}) {
  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, metricool_blog_id')
    .eq('id', params.clientId)
    .single()

  if (!client) notFound()

  const result = client.metricool_blog_id
    ? await fetchClientCaptions(client.metricool_blog_id, client.name)
    : null

  const captions = result?.ok ? result.captions : []
  const fetchError = result && !result.ok ? result.error : null

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/captions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Captions
          </Link>
        </Button>
        <PageHeader
          title={client.name}
          description={
            !client.metricool_blog_id
              ? 'Este cliente no tiene Metricool conectado'
              : fetchError
              ? 'Error al cargar captions'
              : `${captions.length} captions de los últimos 90 días`
          }
        />
      </div>

      {!client.metricool_blog_id ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Conecta el blog de Metricool en{' '}
            <Link href={`/clients/${client.id}`} className="text-primary hover:underline">
              la ficha del cliente
            </Link>{' '}
            para ver sus captions.
          </CardContent>
        </Card>
      ) : fetchError ? (
        <Card className="border-red-300 bg-red-50/40">
          <CardContent className="py-8 text-center space-y-2">
            <p className="text-sm font-medium text-red-700">No se pudieron cargar las captions</p>
            <p className="text-xs text-red-600">{fetchError}</p>
            <p className="text-xs text-muted-foreground">
              Verifica el Metricool blog ID en{' '}
              <Link href={`/clients/${client.id}`} className="text-primary hover:underline">
                la ficha del cliente
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : captions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay publicaciones en los últimos 90 días.
          </CardContent>
        </Card>
      ) : (
        <SavedCaptionsView captions={captions} clientName={client.name} />
      )}
    </div>
  )
}
