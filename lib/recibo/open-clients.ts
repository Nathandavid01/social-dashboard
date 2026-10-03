/**
 * Recibo starts with every client collapsed. A deep link can open one client
 * (notification / Enviar al cliente / ?cliente=). Manual toggles stay in
 * React state and are not written back to the URL.
 */
const QUERY_KEYS = ['cliente', 'client', 'c'] as const

export function reciboDeepLinkClientId(input: {
  cliente?: string | null
  client?: string | null
  c?: string | null
  hash?: string | null
} = {}): string | null {
  for (const key of QUERY_KEYS) {
    const value = input[key]?.trim()
    if (value) return value
  }
  const fromHash = (input.hash ?? '').replace(/^#/, '').trim()
  return fromHash || null
}
