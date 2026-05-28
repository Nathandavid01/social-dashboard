import type { PaymentStatus } from '@/lib/supabase/types'

/**
 * Derive payment status from monthly_fee + most recent payment.
 *   paid        → last payment within ~31 days
 *   overdue     → has monthly_fee but no payment in 31+ days
 *   pending     → has monthly_fee but never been paid
 *   no_contract → no monthly_fee configured
 */
export function derivePaymentStatus(monthlyFee: number | null, lastPaidAt: string | null): PaymentStatus {
  if (!monthlyFee || monthlyFee <= 0) return 'no_contract'
  if (!lastPaidAt) return 'pending'
  const days = (Date.now() - new Date(lastPaidAt).getTime()) / (1000 * 60 * 60 * 24)
  if (days <= 31) return 'paid'
  return 'overdue'
}
