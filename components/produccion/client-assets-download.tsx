import { Download, ImageIcon, Palette, Type, Shield, FileSignature, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClientAsset, ClientAssetKind } from '@/lib/supabase/types'

const KIND_META: Record<ClientAssetKind, { label: string; icon: typeof ImageIcon; tone: string }> = {
  logo:        { label: 'Logo',        icon: ImageIcon,     tone: 'text-purple-500 bg-purple-500/10' },
  color_guide: { label: 'Color guide', icon: Palette,       tone: 'text-pink-500 bg-pink-500/10' },
  font:        { label: 'Tipografía',  icon: Type,          tone: 'text-blue-500 bg-blue-500/10' },
  legal:       { label: 'Legal',       icon: Shield,        tone: 'text-yellow-500 bg-yellow-500/10' },
  contract:    { label: 'Contrato',    icon: FileSignature, tone: 'text-cyan-500 bg-cyan-500/10' },
  other:       { label: 'Otro',        icon: FolderOpen,    tone: 'text-muted-foreground bg-muted' },
}

function formatBytes(n: number | null): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function ClientAssetsDownload({ assets }: { assets: ClientAsset[] }) {
  // Only brand-kit assets are useful to editors; skip contracts/legal here.
  const editable = assets.filter((a) => a.kind === 'logo' || a.kind === 'color_guide' || a.kind === 'font' || a.kind === 'other')

  if (editable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este cliente aún no tiene assets de marca cargados. Súbelos en el perfil del cliente → pestaña Assets.
      </p>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {editable.map((a, i) => {
        const meta = KIND_META[a.kind] ?? KIND_META.other
        const isImage = (a.mime_type ?? '').startsWith('image/')
        return (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            download
            className="group flex items-center gap-3 rounded-lg border p-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300"
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt={a.name} className="h-10 w-10 shrink-0 rounded object-contain" />
            ) : (
              <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded', meta.tone)}>
                <meta.icon className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">{meta.label}{a.size_bytes ? ` · ${formatBytes(a.size_bytes)}` : ''}</p>
            </div>
            <Download className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </a>
        )
      })}
    </div>
  )
}
