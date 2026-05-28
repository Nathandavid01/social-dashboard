'use client'

import { useRef, useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, FileSignature, Upload, Download, FileText } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { updateClientProfile, uploadContract, getContractSignedUrl } from '@/lib/actions/client-profile'
import type { Client } from '@/lib/supabase/types'

interface Props {
  client: Client
}

export function ContractTab({ client }: Props) {
  const [signedAt, setSignedAt] = useState(client.contract_signed_at ?? '')
  const [expiresAt, setExpiresAt] = useState(client.contract_expires_at ?? '')
  const [monthlyFee, setMonthlyFee] = useState(client.monthly_fee?.toString() ?? '')
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const dirty =
    signedAt !== (client.contract_signed_at ?? '') ||
    expiresAt !== (client.contract_expires_at ?? '') ||
    monthlyFee !== (client.monthly_fee?.toString() ?? '')

  function saveMetadata() {
    startTransition(async () => {
      const res = await updateClientProfile(client.id, {
        contract_signed_at: signedAt || null,
        contract_expires_at: expiresAt || null,
        monthly_fee: monthlyFee || null,
      })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: 'Contrato actualizado' })
    })
  }

  async function handleFile(file: File | null) {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast({ title: 'Tipo inválido', description: 'Solo PDF', variant: 'destructive' })
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'Máximo 20 MB', variant: 'destructive' })
      return
    }
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadContract(client.id, fd)
    setUploading(false)
    if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
    else toast({ title: 'PDF subido' })
  }

  async function downloadContract() {
    const res = await getContractSignedUrl(client.id)
    if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
    else if (res.url) window.open(res.url, '_blank')
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4" /> Términos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="signed_at" className="text-xs">Firmado</Label>
              <Input id="signed_at" type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expires_at" className="text-xs">Expira</Label>
              <Input id="expires_at" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthly_fee" className="text-xs">Cuota mensual (USD)</Label>
            <Input
              id="monthly_fee"
              type="number"
              step="0.01"
              min="0"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              placeholder="0.00"
              className="h-9"
            />
          </div>
          <Button onClick={saveMetadata} disabled={!dirty || isPending} size="sm" className="w-full">
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
            Guardar términos
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> PDF del contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {client.contract_url ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="truncate">Contrato cargado</span>
              </div>
              <Button onClick={downloadContract} size="sm" variant="outline">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Abrir
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin PDF cargado.</p>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.classList.add('border-primary', 'bg-primary/5')
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove('border-primary', 'bg-primary/5')}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove('border-primary', 'bg-primary/5')
              handleFile(e.dataTransfer.files?.[0] ?? null)
            }}
            onClick={() => fileRef.current?.click()}
            className="grid cursor-pointer place-items-center rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary/40"
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm">Arrastra el PDF o haz click</p>
                <p className="text-xs text-muted-foreground">Máx. 20 MB</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
