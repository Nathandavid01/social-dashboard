/**
 * Generate a readable temporary password (the user changes it on first login).
 * Avoids ambiguous characters (no 0/O/1/l/I). Shared by "Crear usuario" and
 * "Resetear contraseña". Uses the Web Crypto RNG when available.
 */
export function makeTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const buf = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint32Array(10))
    : Array.from({ length: 10 }, (_, i) => i * 7 + 11)
  const body = Array.from(buf, (n) => chars[n % chars.length]).join('')
  return `Nm${body}9!`
}
