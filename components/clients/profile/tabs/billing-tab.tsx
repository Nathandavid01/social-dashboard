'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Trash2, DollarSign, Loader2, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { addPayment, deletePayment } from '@/lib/actions/client-profile'
import { derivePaymentStatus } from '@/lib/utils/payment-status'
import { cn, formatDate } from '@/lib/utils'
import type { Client, ClientPayment } from '@/lib/supabase/types'

interface Props {
  client: Client
  payments: ClientPayment[]
}

export function BillingTab({ client, payments }: Props) {
  const lastPayment = payments[0] ?? null
  const status = derivePaymentStatus(client.monthly_fee, lastPayment?.paid_at ?? null)
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)

  const statusConfig = {
    paid: { label: 'Al día', icon: CheckCircle2, cls: 'text-green-500 bg-green-500/10 border-green-500/30' },
    overdue: { label: 'Atrasado', icon: AlertCircle, cls: 'text-red-500 bg-red-500/10 border-red-500/30' },
    pending: { label: 'Pendiente', icon: DollarSign, cls: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' },
    no_contract: { label: 'Sin contrato', icon: DollarSign, cls: 'text-muted-foreground bg-muted border-border' },
  } as const
  const sc = statusConfig[status]

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className={cn('border-2 animate-in fade-in zoom-in-95 duration-300', sc.cls)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide opacity-80">Estado</p>
              <sc.icon className="h-4 w-4" />
            </div>
            <p className="mt-1 text-xl font-bold">{sc.label}</p>
          </CardContent>
        </Card>
        <Card className="animate-in fade-in zoom-in-95 duration-300" style={{ animationDelay: '60ms', animationFillMode: 'backwards' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Cuota mensual</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xl font-bold">
              {client.monthly_fee != null ? `$${Number(client.monthly_fee).toFixed(2)}` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="animate-in fade-in zoom-in-95 duration-300" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pagado total</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-xl font-bold">${totalPaid.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{payments.length} pago{payments.length === 1 ? '' : 's'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <CardTitle className="min-w-0 truncate text-base">Historial de pagos</CardTitle>
            <div className="shrink-0">
              <AddPaymentDialog clientId={client.id} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay pagos registrados.</p>
          ) : (
            <ul className="divide-y">
              {payments.map((p, i) => (
                <PaymentRow key={p.id} payment={p} clientId={client.id} index={i} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PaymentRow({ payment, clientId, index }: { payment: ClientPayment; clientId: string; index: number }) {
  const [isDeleting, startDelete] = useTransition()
  const { toast } = useToast()

  return (
    <li
      className="flex items-center justify-between py-3 animate-in fade-in slide-in-from-left-1 duration-300"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-base font-semibold tabular-nums">${Number(payment.amount).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(payment.paid_at)}</p>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {payment.method && <span>{payment.method}</span>}
          {payment.reference && <span>· Ref: {payment.reference}</span>}
          {payment.notes && <span className="truncate">· {payment.notes}</span>}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        disabled={isDeleting}
        onClick={() => {
          if (!confirm('¿Eliminar este pago?')) return
          startDelete(async () => {
            const res = await deletePayment(payment.id, clientId)
            if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
            else toast({ title: 'Pago eliminado' })
          })
        }}
        aria-label="Eliminar pago"
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </li>
  )
}

function AddPaymentDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function submit() {
    startTransition(async () => {
      const res = await addPayment(clientId, {
        amount,
        paid_at: paidAt,
        method: method || undefined,
        reference: reference || undefined,
        notes: notes || undefined,
      })
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Pago agregado' })
      setOpen(false)
      setAmount('')
      setMethod('')
      setReference('')
      setNotes('')
      setPaidAt(new Date().toISOString().slice(0, 10))
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="transition-transform hover:scale-105">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar pago
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo pago</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p_amount" className="text-xs">Monto (USD)</Label>
              <Input id="p_amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_date" className="text-xs">Fecha</Label>
              <Input id="p_date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p_method" className="text-xs">Método</Label>
              <Input id="p_method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="ACH / Check / Zelle…" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_ref" className="text-xs">Referencia</Label>
              <Input id="p_ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="#INV-001" className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p_notes" className="text-xs">Notas</Label>
            <Textarea id="p_notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!amount || isPending}>
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Guardar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
