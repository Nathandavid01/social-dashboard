export type ArrivalStamp = {
  userId: string
  name: string
  at: string
  lat?: number | null
  lng?: number | null
}

export function alreadyCheckedIn(
  userId: string | null | undefined,
  arrivals: Array<{ userId: string }>,
): boolean {
  if (!userId) return false
  return arrivals.some((a) => a.userId === userId)
}

export function formatArrivalStamp(a: { name: string; at: string }): string {
  const time = new Intl.DateTimeFormat('es-PR', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico',
  }).format(new Date(a.at))
  return `${a.name} llegó · ${time}`
}
