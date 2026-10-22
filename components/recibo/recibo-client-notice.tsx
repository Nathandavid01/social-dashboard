/** Only explicitly marked production notices belong on the staff Recibo board. */
export function ReciboClientNotice({ notice }: { notice?: string | null }) {
  if (!notice?.trim()) return null
  return (
    <p role="note" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      {notice}
    </p>
  )
}
