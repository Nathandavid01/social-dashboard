/** Explicit user-approved identities. Roles, display names and area grants cannot add viewers. */
const VIEWERS: ReadonlySet<string> = new Set([
  'a16752e4-05d1-42e3-812c-28a1afb5752c', // Denisha Matos
  '165e5259-8f69-4ff4-b0f0-f790cba77b80', // Nathan Torres (not Nathan Test)
])

export function canAccessVideoInventory(userId: string | null | undefined): boolean {
  return !!userId && VIEWERS.has(userId)
}
