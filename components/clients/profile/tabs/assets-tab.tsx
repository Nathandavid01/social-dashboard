'use client'

import { useRef, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Upload, Trash2, Image as ImageIcon, FileText, Palette, Type, Shield, FileSignature, FolderOpen, Loader2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { uploadClientAsset, deleteClientAsset } from '@/lib/actions/client-profile'
import { cn } from '@/lib/utils'
import type { ClientAsset, ClientAssetKind } from '@/lib/supabase/types'

interface Props {
  clientId: string
  assets: ClientAsset[]
}

const KIND_META: Record<ClientAssetKind, { label: string; icon: typeof ImageIcon; tone: string }> = {
  logo:         { label: 'Logos',          icon: ImageIcon,     tone: 'text-purple-500 bg-purple-500/10' },
  color_guide:  { label: 'Color guides',   icon: Palette,       tone: 'text-pink-500 bg-pink-500/10' },
  font:         { label: 'Tipografías',    icon: Type,          tone: 'text-blue-500 bg-blue-500/10' },
  legal:        { label: 'Legales',        icon: Shield,        tone: 'text-yellow-500 bg-yellow-500/10' },
  contract:     { label: 'Contratos',      icon: FileSignature, tone: 'text-cyan-500 bg-cyan-500/10' },
  other:        { label: 'Otros',          icon: FolderOpen,    tone: 'text-muted-foreground bg-muted' },
}

function formatBytes(n: number | null): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function AssetsTab({ clientId, assets }: Props) {
  const [filter, setFilter] = useState<ClientAssetKind | 'all'>('all')

  const filtered = filter === 'all' ? assets : assets.filter((a) => a.kind === filter)

  const kinds: (ClientAssetKind | 'all')[] = ['all', 'logo', 'color_guide', 'font', 'legal', 'contract', 'other']

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar flex w-full gap-1.5 overflow-x-auto sm:w-auto">
          {kinds.map((k) => {
            const active = filter === k
            const count = k === 'all' ? assets.length : assets.filter((a) => a.kind === k).length
            const label = k === 'all' ? 'Todos' : KIND_META[k].label
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:scale-105',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                )}
              >
                {label} <span className="ml-1 tabular-nums opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
        <UploadAssetDialog clientId={clientId} />
      </div>

      {/* Gallery */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-2 py-12 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Sin assets en esta categoría.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((a, i) => (
            <AssetCard key={a.id} asset={a} clientId={clientId} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function AssetCard({ asset, clientId, index }: { asset: ClientAsset; clientId: string; index: number }) {
  const meta = KIND_META[asset.kind] ?? KIND_META.other
  const isImage = (asset.mime_type ?? '').startsWith('image/')
  const [isDeleting, startDelete] = useTransition()
  const { toast } = useToast()

  return (
    <Card
      className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md animate-in fade-in slide-in-from-bottom-1 duration-300"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
    >
      {/* Preview */}
      <div className="relative aspect-video bg-muted">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt={asset.name} className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className={cn('grid h-full w-full place-items-center', meta.tone)}>
            <meta.icon className="h-10 w-10 opacity-80" />
          </div>
        )}
        <div className="absolute right-2 top-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', meta.tone)}>{meta.label.slice(0, -1)}</span>
        </div>
      </div>
      <CardContent className="space-y-1 p-3">
        <p className="truncate text-sm font-medium">{asset.name}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatBytes(asset.size_bytes)}</span>
          <div className="flex items-center gap-1">
            {isImage && (
              <a href={asset.url} target="_blank" rel="noreferrer" className="rounded p-1 hover:text-foreground" aria-label="Abrir">
                <FileText className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              onClick={() => {
                if (!confirm(`¿Eliminar "${asset.name}"?`)) return
                startDelete(async () => {
                  const res = await deleteClientAsset(asset.id, clientId)
                  if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
                  else toast({ title: 'Asset eliminado' })
                })
              }}
              className="rounded p-1 hover:text-destructive"
              aria-label="Eliminar"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function UploadAssetDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ClientAssetKind>('logo')
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  function submit() {
    if (!file) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', kind)
      if (name) fd.append('name', name)
      const res = await uploadClientAsset(clientId, fd)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else {
        toast({ title: 'Asset subido' })
        setOpen(false)
        setFile(null)
        setName('')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="transition-transform hover:scale-105">
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Subir asset
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subir asset</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.classList.add('border-primary', 'bg-primary/5')
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove('border-primary', 'bg-primary/5')}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove('border-primary', 'bg-primary/5')
              const f = e.dataTransfer.files?.[0] ?? null
              setFile(f)
              if (f && !name) setName(f.name)
            }}
            className="grid cursor-pointer place-items-center rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary/40"
          >
            {file ? (
              <p className="text-sm font-medium">{file.name}</p>
            ) : (
              <>
                <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm">Drop o click</p>
                <p className="text-xs text-muted-foreground">Máx. 50 MB</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                if (f && !name) setName(f.name)
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ClientAssetKind)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="logo">Logo</SelectItem>
                  <SelectItem value="color_guide">Color guide</SelectItem>
                  <SelectItem value="font">Tipografía</SelectItem>
                  <SelectItem value="legal">Documento legal</SelectItem>
                  <SelectItem value="contract">Contrato / addendum</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a_name" className="text-xs">Nombre</Label>
              <Input id="a_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Logo principal" className="h-9" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={submit} disabled={!file || isPending}>
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
