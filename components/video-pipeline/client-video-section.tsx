import Link from 'next/link'
import { Film, ImageIcon, Palette, Type, FolderOpen, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, platformColors, platformLabels } from '@/lib/utils'
import { VideoCard } from './video-card'
import type { ClientVideoPipeline } from '@/lib/actions/video-pipeline'
import type { ClientAsset, ClientAssetKind, SocialPlatform } from '@/lib/supabase/types'

// Only brand-kit assets are shown on the pipeline (skip contracts/legal).
const SHARED_ASSET_KINDS: ClientAssetKind[] = ['logo', 'color_guide', 'font', 'other']

const ASSET_META: Record<ClientAssetKind, { label: string; icon: typeof ImageIcon; tone: string }> = {
  logo:        { label: 'Logo',        icon: ImageIcon,  tone: 'text-purple-500 bg-purple-500/10' },
  color_guide: { label: 'Color guide', icon: Palette,    tone: 'text-pink-500 bg-pink-500/10' },
  font:        { label: 'Tipografía',  icon: Type,       tone: 'text-blue-500 bg-blue-500/10' },
  legal:       { label: 'Legal',       icon: FolderOpen, tone: 'text-yellow-500 bg-yellow-500/10' },
  contract:    { label: 'Contrato',    icon: FolderOpen, tone: 'text-cyan-500 bg-cyan-500/10' },
  other:       { label: 'Otro',        icon: FolderOpen, tone: 'text-muted-foreground bg-muted' },
}

export function ClientVideoSection({ pipeline }: { pipeline: ClientVideoPipeline }) {
  const { client, videos, assets } = pipeline
  const sharedAssets = assets.filter((a) => SHARED_ASSET_KINDS.includes(a.kind))
  const platforms = (client.platforms ?? []) as SocialPlatform[]
  const primaryColor = client.brand_colors?.primary ?? null

  return (
    <section className="space-y-4 rounded-xl border bg-card/40 p-4 sm:p-5 animate-in fade-in duration-300">
      {/* Compact profile header */}
      <header className="relative overflow-hidden rounded-lg border bg-card">
        {primaryColor && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-30 blur-2xl"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, transparent 70%)` }}
          />
        )}
        <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <ClientLogo client={client} />
            <div className="min-w-0">
              <Link
                href={`/clients/${client.id}`}
                className="truncate text-base font-bold tracking-tight hover:text-primary"
              >
                {client.name}
              </Link>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {client.industry && <span className="truncate">{client.industry}</span>}
                {platforms.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {platforms.map((p) => (
                      <Badge key={p} variant="outline" className={cn('text-[10px]', platformColors[p])}>
                        {platformLabels[p]}
                      </Badge>
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 whitespace-nowrap tabular-nums">
            {videos.length} {videos.length === 1 ? 'video' : 'videos'}
          </Badge>
        </div>

        {/* Read-only shared-assets strip */}
        {sharedAssets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/30 px-3.5 py-2.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Assets compartidos
            </span>
            {sharedAssets.map((a) => (
              <SharedAssetChip key={a.id} asset={a} />
            ))}
          </div>
        )}
      </header>

      {/* Card grid / empty state */}
      {videos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Film className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">Sin videos en el pipeline</p>
          <p className="text-xs text-muted-foreground/70">
            Las ideas de contenido de este cliente aparecerán aquí como videos.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </section>
  )
}

function ClientLogo({ client }: { client: ClientVideoPipeline['client'] }) {
  if (client.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={client.logo_url}
        alt={client.name}
        className="h-11 w-11 shrink-0 rounded-lg border object-contain bg-background p-0.5"
      />
    )
  }
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border bg-muted text-sm font-bold text-muted-foreground">
      {client.name?.slice(0, 2).toUpperCase() || '??'}
    </div>
  )
}

function SharedAssetChip({ asset }: { asset: ClientAsset }) {
  const meta = ASSET_META[asset.kind] ?? ASSET_META.other
  const Icon = meta.icon
  const isImage = (asset.mime_type ?? '').startsWith('image/')
  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noreferrer"
      download
      className="group inline-flex max-w-[10rem] items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px] transition-colors hover:border-primary/40 hover:text-primary"
      title={`Descargar ${asset.name}`}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.url} alt={asset.name} className="h-4 w-4 shrink-0 rounded object-contain" />
      ) : (
        <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded', meta.tone)}>
          <Icon className="h-2.5 w-2.5" />
        </span>
      )}
      <span className="truncate">{asset.name}</span>
      <Download className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
    </a>
  )
}
