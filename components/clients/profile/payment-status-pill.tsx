import { CheckCircle2, AlertCircle, Clock, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { derivePaymentStatus } from '@/lib/utils/payment-status'
import type { ClientPayment, PaymentStatus } from '@/lib/supabase/types'

interface Props {
  monthlyFee: number | null
  lastPayment: ClientPayment | null
}

const config: Record<PaymentStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  paid: {
    label: 'Pagado',
    icon: CheckCircle2,
    className: 'bg-green-500/10 text-green-500 border-green-500/30',
  },
  overdue: {
    label: 'Atrasado',
    icon: AlertCircle,
    className: 'bg-red-500/10 text-red-500 border-red-500/30 animate-pulse',
  },
  pending: {
    label: 'Pendiente',
    icon: Clock,
    className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  },
  no_contract: {
    label: 'Sin contrato',
    icon: Minus,
    className: 'bg-muted text-muted-foreground border-border',
  },
}

export function PaymentStatusPill({ monthlyFee, lastPayment }: Props) {
  const status = derivePaymentStatus(monthlyFee, lastPayment?.paid_at ?? null)
  const { label, icon: Icon, className } = config[status]

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 md:items-end md:flex-row md:gap-2 md:px-3 md:py-2',
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="text-center md:text-right">
        <p className="text-[10px] uppercase tracking-wide opacity-80 md:text-xs">Pago</p>
        <p className="text-xs font-semibold md:text-sm">{label}</p>
      </div>
    </div>
  )
}
