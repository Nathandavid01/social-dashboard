'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getImportableMetricoolBrands, importMetricoolBrands } from '@/lib/actions/metricool-import'
import type { BrandLike } from '@/lib/utils/metricool-import-core'

export function ImportMetricoolButton() {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brands, setBrands] = useState<BrandLike[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isImporting, startImport] = useTransition()

  async function openAndLoad() {
    setOpen(true)
    setLoading(true)
    setError(null)
    const res = await getImportableMetricoolBrands()
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setBrands(res.brands ?? [])
    setSelected(new Set((res.brands ?? []).map((b) => b.id))) // select all by default
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function runImport() {
    const picked = brands.filter((b) => selected.has(b.id)).map((b) => ({ id: b.id, name: b.name }))
    startImport(async () => {
      const res = await importMetricoolBrands(picked)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        return
      }
      toast({ title: `${res.imported} cliente${res.imported === 1 ? '' : 's'} importado${res.imported === 1 ? '' : 's'}` })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="outline" onClick={openAndLoad}>
        <Download className="mr-2 h-4 w-4" />
        Importar de Metricool
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar clientes de Metricool</DialogTitle>
            <DialogDescription>
              Marcas conectadas en Metricool que aún no son clientes. Se crean con su nombre y su blog id enlazado.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando marcas…
            </div>
          ) : error ? (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          ) : brands.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todas las marcas de Metricool ya están como clientes. 🎉
            </p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {brands.map((b) => {
                const checked = selected.has(b.id)
                return (
                  <label
                    key={b.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors',
                      checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
                    )}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(b.id)} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      {b.provider && <p className="text-xs text-muted-foreground">{b.provider}</p>}
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          {!loading && !error && brands.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isImporting}>
                Cancelar
              </Button>
              <Button onClick={runImport} disabled={isImporting || selected.size === 0}>
                {isImporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
                Importar ({selected.size})
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
